FROM postgres:16-alpine

# Install extensions if needed
# RUN apk add --no-cache postgresql-contrib

# Copy initialization scripts (optional)
# These scripts will run when the database is first created
# COPY init.sql /docker-entrypoint-initdb.d/

# Set default environment variables (can be overridden in docker-compose)
ENV POSTGRES_DB=s_pavilion
ENV POSTGRES_USER=admin
ENV POSTGRES_PASSWORD=changeme

# Expose PostgreSQL port
EXPOSE 5432

# Use the default postgres entrypoint
