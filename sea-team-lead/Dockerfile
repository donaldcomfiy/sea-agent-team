# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

FROM python:3.12-slim

# Node.js 22 (LTS) is required at runtime for the MongoDB MCP Server,
# started via `npx @mongodb-js/mongodb-mcp-server` in app/common.py.
# Pre-install the server globally so the first tool call doesn't download it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @mongodb-js/mongodb-mcp-server \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv==0.8.13

WORKDIR /code

COPY ./pyproject.toml ./README.md ./uv.lock* ./

COPY ./app ./app

# Excel template for save_campaign_as_excel; without it the export falls back
# to an unstyled layout.
COPY ./data/template/adsforsocial_analyse.xlsx ./data/template/adsforsocial_analyse.xlsx

RUN uv sync --frozen

RUN useradd --create-home --shell /bin/bash appuser
USER appuser

ARG COMMIT_SHA=""
ENV COMMIT_SHA=${COMMIT_SHA}

ARG AGENT_VERSION=0.0.0
ENV AGENT_VERSION=${AGENT_VERSION}

EXPOSE 8080

CMD ["sh", "-c", "uv run --no-sync uvicorn app.fast_api_app:app --host 0.0.0.0 --port ${PORT:-8080}"]
