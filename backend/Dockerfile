FROM python:3.13-slim

WORKDIR /app

# System deps for psycopg and compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ make \
    libpq-dev \
    default-jdk \
    && rm -rf /var/lib/apt/lists/*

# Python deps first (layer-cached unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect static files at build time
RUN python manage.py collectstatic --noinput

EXPOSE 8000
