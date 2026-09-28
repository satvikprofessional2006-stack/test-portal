"""
Subprocess-based code execution sandbox.

Runs student code in a child process with:
- Execution timeout via SIGALRM / threading
- Memory limit via resource module (RLIMIT_AS)
- Output truncation
- Filesystem isolation (temp dir, cleaned up after run)
- No network access enforcement (Docker handles this in production)

This is the DEVELOPMENT backend. In production, swap for docker_sandbox.py
by setting EXECUTION_BACKEND=docker in environment.
"""

import logging
import os
import resource
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)

# ─── Language specifications ──────────────────────────────────────────────────

LANGUAGE_SPECS = {
    "cpp": {
        "extension": ".cpp",
        "compile": ["g++", "-std=c++17", "-O2", "-o", "{binary}", "{source}"],
        "run": ["{binary}"],
        "compiled": True,
    },
    "cpp17": {
        "extension": ".cpp",
        "compile": ["g++", "-std=c++17", "-O2", "-o", "{binary}", "{source}"],
        "run": ["{binary}"],
        "compiled": True,
    },
    "c": {
        "extension": ".c",
        "compile": ["gcc", "-O2", "-o", "{binary}", "{source}"],
        "run": ["{binary}"],
        "compiled": True,
    },
    "python": {
        "extension": ".py",
        "compile": None,
        "run": [sys.executable, "{source}"],
        "compiled": False,
    },
    "python3": {
        "extension": ".py",
        "compile": None,
        "run": [sys.executable, "{source}"],
        "compiled": False,
    },
    "javascript": {
        "extension": ".js",
        "compile": None,
        "run": ["node", "{source}"],
        "compiled": False,
    },
    "js": {
        "extension": ".js",
        "compile": None,
        "run": ["node", "{source}"],
        "compiled": False,
    },
    "java": {
        "extension": ".java",
        "compile": ["javac", "{source}"],
        "run": ["java", "-cp", "{workdir}", "Main"],
        "compiled": True,
        "source_filename": "Main",  # must match public class name
    },
}


@dataclass
class ExecutionResult:
    verdict: str = "internal_error"
    stdout: str = ""
    stderr: str = ""
    compiler_output: str = ""
    exit_code: Optional[int] = None
    time_ms: Optional[int] = None
    memory_mb: Optional[float] = None


def _run_subprocess(cmd, stdin_data, timeout_s, memory_limit_mb, output_limit_bytes):
    """
    Run a subprocess with timeout and memory limits.
    Returns (stdout, stderr, exit_code, elapsed_ms, memory_mb_used).
    """

    def set_limits():
        try:
            # Memory limit (virtual address space) — supported on Linux; on macOS RLIMIT_AS cannot be lowered without error
            if sys.platform.startswith("linux"):
                limit_bytes = memory_limit_mb * 1024 * 1024
                resource.setrlimit(resource.RLIMIT_AS, (limit_bytes, limit_bytes))
        except Exception:
            pass

        try:
            # Prevent fork bombs
            resource.setrlimit(resource.RLIMIT_NPROC, (128, 128))
        except Exception:
            pass

        try:
            # Limit file size written (OLE protection)
            resource.setrlimit(resource.RLIMIT_FSIZE, (output_limit_bytes, output_limit_bytes))
        except Exception:
            pass

    start = time.perf_counter()
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=set_limits if sys.platform != "win32" else None,
            text=True,
        )
        try:
            stdout, stderr = proc.communicate(
                input=stdin_data,
                timeout=timeout_s,
            )
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.communicate()
            elapsed = int((time.perf_counter() - start) * 1000)
            return "", "", None, elapsed, None, "tle"

        elapsed = int((time.perf_counter() - start) * 1000)

        # Truncate output
        stdout = stdout[:output_limit_bytes]
        stderr = stderr[:4096]

        # Detect memory errors
        if proc.returncode == -9:  # SIGKILL — usually OOM
            return stdout, stderr, proc.returncode, elapsed, None, "mle"

        return stdout, stderr, proc.returncode, elapsed, None, None

    except FileNotFoundError as exc:
        # Compiler/runtime binary not found
        return "", str(exc), -1, 0, None, "internal_error"
    except Exception as exc:
        logger.exception("Unexpected subprocess error: %s", exc)
        return "", str(exc), -1, 0, None, "internal_error"


def execute(
    language: str,
    code: str,
    stdin: str = "",
    time_limit_ms: int = None,
    memory_limit_mb: int = None,
) -> ExecutionResult:
    """
    Compile (if needed) and run student code.
    Returns an ExecutionResult with verdict, output, and metrics.
    """
    spec = LANGUAGE_SPECS.get(language)
    if not spec:
        return ExecutionResult(verdict="internal_error", stderr=f"Unknown language: {language}")

    timeout_s = (time_limit_ms or settings.EXECUTION_TIMEOUT_SECONDS * 1000) / 1000
    mem_mb = memory_limit_mb or settings.EXECUTION_MEMORY_LIMIT_MB
    out_limit = settings.EXECUTION_OUTPUT_LIMIT_BYTES

    workdir = tempfile.mkdtemp(prefix="examportal_")
    try:
        # ── Write source file ──────────────────────────────────────────────
        filename = spec.get("source_filename", "solution")
        source_path = os.path.join(workdir, filename + spec["extension"])
        with open(source_path, "w", encoding="utf-8") as f:
            f.write(code)

        # ── Compile (if compiled language) ─────────────────────────────────
        compiler_output = ""
        if spec["compiled"] and spec["compile"]:
            binary_path = os.path.join(workdir, "solution_bin")
            compile_cmd = [
                part.replace("{source}", source_path)
                         .replace("{binary}", binary_path)
                         .replace("{workdir}", workdir)
                for part in spec["compile"]
            ]
            compile_result = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=30,  # Compilation has its own timeout
            )
            compiler_output = (compile_result.stdout + compile_result.stderr)[:4096]
            if compile_result.returncode != 0:
                return ExecutionResult(
                    verdict="compilation_error",
                    compiler_output=compiler_output,
                )

        # ── Build run command ──────────────────────────────────────────────
        binary_path = os.path.join(workdir, "solution_bin")
        run_cmd = [
            part.replace("{source}", source_path)
                .replace("{binary}", binary_path)
                .replace("{workdir}", workdir)
            for part in spec["run"]
        ]

        # ── Execute ────────────────────────────────────────────────────────
        stdout, stderr, exit_code, elapsed_ms, _, forced_verdict = _run_subprocess(
            run_cmd, stdin, timeout_s, mem_mb, out_limit,
        )

        if forced_verdict:
            return ExecutionResult(
                verdict=forced_verdict,
                stdout=stdout,
                stderr=stderr,
                compiler_output=compiler_output,
                exit_code=exit_code,
                time_ms=elapsed_ms,
            )

        if exit_code != 0:
            verdict = "runtime_error"
        else:
            verdict = "accepted"  # Caller compares stdout vs expected

        return ExecutionResult(
            verdict=verdict,
            stdout=stdout,
            stderr=stderr[:4096],
            compiler_output=compiler_output,
            exit_code=exit_code,
            time_ms=elapsed_ms,
        )

    except subprocess.TimeoutExpired:
        return ExecutionResult(verdict="tle", time_ms=int(timeout_s * 1000))
    except Exception as exc:
        logger.exception("Execution engine error: %s", exc)
        return ExecutionResult(verdict="internal_error", stderr=str(exc)[:1000])
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def judge(language, code, test_cases, time_limit_ms=None, memory_limit_mb=None):
    """
    Run code against a list of test cases and return per-case results.
    Short-circuits on compilation error.
    Returns list of dicts with verdict, stdout, stderr, time_ms per test case.
    """
    results = []

    # Compile once for compiled languages
    spec = LANGUAGE_SPECS.get(language, {})

    # Run each test case
    for tc in test_cases:
        tc_time = tc.get("time_limit_ms") or time_limit_ms
        tc_mem = tc.get("memory_limit_mb") or memory_limit_mb
        result = execute(
            language=language,
            code=code,
            stdin=tc["input_data"],
            time_limit_ms=tc_time,
            memory_limit_mb=tc_mem,
        )

        # If compilation failed on first TC, no point continuing
        if result.verdict == "compilation_error":
            results.append({
                "test_case_id": tc["id"],
                "verdict": "compilation_error",
                "stdout": "",
                "stderr": result.compiler_output,
                "time_ms": 0,
                "output_matched": False,
            })
            # Fill remaining TCs with CE
            for remaining in test_cases[len(results):]:
                results.append({
                    "test_case_id": remaining["id"],
                    "verdict": "compilation_error",
                    "stdout": "",
                    "stderr": "",
                    "time_ms": 0,
                    "output_matched": False,
                })
            return results

        expected = tc["expected_output"].rstrip()
        actual = result.stdout.rstrip()
        output_matched = (actual == expected) if result.verdict == "accepted" else False

        if result.verdict == "accepted" and not output_matched:
            verdict = "wrong_answer"
        else:
            verdict = result.verdict

        results.append({
            "test_case_id": tc["id"],
            "verdict": verdict,
            "stdout": result.stdout[:4096],
            "stderr": result.stderr[:2048],
            "time_ms": result.time_ms,
            "output_matched": output_matched,
        })

    return results
