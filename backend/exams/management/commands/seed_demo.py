"""Management command to populate rich seed data for testing both portals."""

import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from accounts.models import User, UserRole
from exams.models import Exam, Question, TestCase, ExamEnrollment


class Command(BaseCommand):
    help = "Seeds demo users, exams, questions, and test cases."

    def handle(self, *args, **options):
        self.stdout.write("Seeding demo data for Test Portal...")

        # 1. Admin User
        admin, _ = User.objects.get_or_create(
            email="admin@college.edu",
            defaults={
                "full_name": "System Administrator",
                "role": UserRole.ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin.set_password("Admin@12345")
        admin.save()
        self.stdout.write(f"✓ Admin ready: admin@college.edu / Admin@12345")

        # 2. Student Users
        students_data = [
            ("student1@college.edu", "Alex Rivera", "CS2026-001", "Computer Science"),
            ("student2@college.edu", "Maya Patel", "CS2026-002", "Information Technology"),
            ("student3@college.edu", "Liam Chen", "CS2026-003", "Software Engineering"),
        ]
        students = []
        for email, name, roll, dept in students_data:
            s, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    "full_name": name,
                    "role": UserRole.STUDENT,
                    "roll_number": roll,
                    "institution": "Institute of Engineering & Technology",
                    "department": dept,
                },
            )
            s.set_password("Student@12345")
            s.save()
            students.append(s)
            self.stdout.write(f"✓ Student ready: {email} / Student@12345")

        now = timezone.now()

        # 3. Live Exam (Currently active)
        live_exam, _ = Exam.objects.get_or_create(
            title="CS301: Data Structures & Algorithms Examination",
            defaults={
                "description": "Comprehensive practical evaluation on algorithm design, time complexity, and problem solving.",
                "instructions": (
                    "1. Read all problem statements, input/output specifications, and constraints carefully.\n"
                    "2. You can use any of the allowed languages (Python, JavaScript, C++, C, Java).\n"
                    "3. Use the 'Run Code' button to test your solution against custom input.\n"
                    "4. Submit your solution against evaluation test cases before time runs out.\n"
                    "5. Anti-cheat monitoring is enabled. Do not switch tabs or exit fullscreen."
                ),
                "scheduled_start": now - datetime.timedelta(hours=1),
                "scheduled_end": now + datetime.timedelta(hours=23),
                "duration_seconds": 5400,  # 90 minutes
                "allowed_languages": ["python", "javascript", "cpp", "c", "java"],
                "passing_score": 50,
                "is_published": True,
                "created_by": admin,
            },
        )
        self.stdout.write(f"✓ Live Exam: {live_exam.title}")

        # 4. Questions for Live Exam
        q1_data = {
            "title": "Two Sum (Array Indices)",
            "statement": (
                "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`.\n\n"
                "You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order (indices separated by space)."
            ),
            "input_format": (
                "The first line contains an integer N, the size of the array.\n"
                "The second line contains N space-separated integers representing the array.\n"
                "The third line contains an integer representing the target."
            ),
            "output_format": "Print the two 0-based indices separated by a space, sorted in ascending order.",
            "constraints": "2 <= N <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
            "notes": "Optimal solution is O(N) using a hash map.",
            "sample_input": "4\n2 7 11 15\n9",
            "sample_output": "0 1",
            "sample_explanation": "Because nums[0] + nums[1] == 2 + 7 == 9, we return 0 1.",
            "time_limit_ms": 2000,
            "memory_limit_mb": 256,
            "marks": 30,
        }

        q1, _ = Question.objects.get_or_create(exam=live_exam, order=1, defaults=q1_data)

        # Q1 Test Cases
        TestCase.objects.filter(question=q1).delete()
        TestCase.objects.create(
            question=q1,
            input_data="4\n2 7 11 15\n9",
            expected_output="0 1",
            is_hidden=False,
            order=1,
            explanation="Sample visible test case",
        )
        TestCase.objects.create(
            question=q1,
            input_data="3\n3 2 4\n6",
            expected_output="1 2",
            is_hidden=True,
            order=2,
            explanation="Hidden test case with non-zero start",
        )
        TestCase.objects.create(
            question=q1,
            input_data="2\n3 3\n6",
            expected_output="0 1",
            is_hidden=True,
            order=3,
            explanation="Hidden test case with duplicate values",
        )
        TestCase.objects.create(
            question=q1,
            input_data="5\n-1 -2 -3 -4 -5\n-8",
            expected_output="2 4",
            is_hidden=True,
            order=4,
            explanation="Hidden test case with negative numbers",
        )

        q2_data = {
            "title": "Valid Parentheses Checker",
            "statement": (
                "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\n"
                "An input string is valid if:\n"
                "1. Open brackets must be closed by the same type of brackets.\n"
                "2. Open brackets must be closed in the correct order.\n"
                "3. Every close bracket has a corresponding open bracket of the same type."
            ),
            "input_format": "A single line containing the string s.",
            "output_format": "Print 'true' if the bracket sequence is valid, otherwise print 'false'.",
            "constraints": "1 <= s.length <= 10^4\ns consists of parentheses only '()[]{}'.",
            "notes": "Use a stack data structure for linear time verification.",
            "sample_input": "()[]{}",
            "sample_output": "true",
            "sample_explanation": "All brackets open and close in corresponding matched pairs.",
            "time_limit_ms": 2000,
            "memory_limit_mb": 256,
            "marks": 30,
        }

        q2, _ = Question.objects.get_or_create(exam=live_exam, order=2, defaults=q2_data)

        TestCase.objects.filter(question=q2).delete()
        TestCase.objects.create(
            question=q2,
            input_data="()[]{}",
            expected_output="true",
            is_hidden=False,
            order=1,
            explanation="Sample visible case",
        )
        TestCase.objects.create(
            question=q2,
            input_data="(]",
            expected_output="false",
            is_hidden=True,
            order=2,
            explanation="Hidden mismatch",
        )
        TestCase.objects.create(
            question=q2,
            input_data="([{}])",
            expected_output="true",
            is_hidden=True,
            order=3,
            explanation="Hidden nested valid brackets",
        )
        TestCase.objects.create(
            question=q2,
            input_data="(((((((",
            expected_output="false",
            is_hidden=True,
            order=4,
            explanation="Hidden unclosed brackets",
        )

        q3_data = {
            "title": "Reverse Words in a String",
            "statement": (
                "Given an input string `s`, reverse the order of the words.\n\n"
                "A word is defined as a sequence of non-space characters. The words in `s` will be separated by at least one space.\n"
                "Return a string of the words in reverse order concatenated by a single space."
            ),
            "input_format": "A single line containing string s.",
            "output_format": "The reversed string with words separated by single spaces.",
            "constraints": "1 <= s.length <= 10^4",
            "notes": "Reduce multiple consecutive spaces into a single space in output.",
            "sample_input": "the sky is blue",
            "sample_output": "blue is sky the",
            "sample_explanation": "The order of words is reversed.",
            "time_limit_ms": 2000,
            "memory_limit_mb": 256,
            "marks": 40,
        }

        q3, _ = Question.objects.get_or_create(exam=live_exam, order=3, defaults=q3_data)

        TestCase.objects.filter(question=q3).delete()
        TestCase.objects.create(
            question=q3,
            input_data="the sky is blue",
            expected_output="blue is sky the",
            is_hidden=False,
            order=1,
        )
        TestCase.objects.create(
            question=q3,
            input_data="  hello world  ",
            expected_output="world hello",
            is_hidden=True,
            order=2,
        )
        TestCase.objects.create(
            question=q3,
            input_data="a good   example",
            expected_output="example good a",
            is_hidden=True,
            order=3,
        )

        # 5. Enroll students into live exam
        for s in students:
            ExamEnrollment.objects.get_or_create(
                exam=live_exam,
                student=s,
                defaults={"status": ExamEnrollment.Status.ENROLLED},
            )

        # 6. Upcoming Exam
        upcoming_exam, _ = Exam.objects.get_or_create(
            title="CS402: Advanced Systems & Distributed Computing",
            defaults={
                "description": "Midterm examination focusing on concurrency, synchronization, and socket programming.",
                "instructions": "Standard college examination honor code applies.",
                "scheduled_start": now + datetime.timedelta(days=2),
                "scheduled_end": now + datetime.timedelta(days=3),
                "duration_seconds": 7200,
                "allowed_languages": ["python", "cpp", "go", "rust"],
                "passing_score": 50,
                "is_published": True,
                "created_by": admin,
            },
        )
        for s in students:
            ExamEnrollment.objects.get_or_create(
                exam=upcoming_exam,
                student=s,
                defaults={"status": ExamEnrollment.Status.ENROLLED},
            )

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully!"))
