{{/*
Expand the name of the chart.
*/}}
{{- define "visiontest.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this.
*/}}
{{- define "visiontest.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels applied to all resources.
*/}}
{{- define "visiontest.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: visiontest-ai
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{/*
Selector labels for a specific component.
Usage: include "visiontest.selectorLabels" (dict "component" "api" "context" .)
*/}}
{{- define "visiontest.selectorLabels" -}}
app.kubernetes.io/name: {{ include "visiontest.name" .context }}-{{ .component }}
app.kubernetes.io/instance: {{ .context.Release.Name }}
{{- end }}

{{/*
Build the API container image reference.
*/}}
{{- define "visiontest.apiImage" -}}
{{- $repo := .Values.api.image.repository | default (printf "%s/visiontest-api" .Values.global.imageRegistry) }}
{{- printf "%s:%s" $repo (.Values.api.image.tag | default "latest") }}
{{- end }}

{{/*
Build the Web container image reference.
*/}}
{{- define "visiontest.webImage" -}}
{{- $repo := .Values.web.image.repository | default (printf "%s/visiontest-web" .Values.global.imageRegistry) }}
{{- printf "%s:%s" $repo (.Values.web.image.tag | default "latest") }}
{{- end }}

{{/*
Build the Worker container image reference.
*/}}
{{- define "visiontest.workerImage" -}}
{{- $repo := .Values.worker.image.repository | default (printf "%s/visiontest-worker" .Values.global.imageRegistry) }}
{{- printf "%s:%s" $repo (.Values.worker.image.tag | default "latest") }}
{{- end }}

{{/*
Build the Embeddings container image reference.
*/}}
{{- define "visiontest.embeddingsImage" -}}
{{- $repo := .Values.embeddings.image.repository | default (printf "%s/visiontest-embeddings" .Values.global.imageRegistry) }}
{{- printf "%s:%s" $repo (.Values.embeddings.image.tag | default "latest") }}
{{- end }}

{{/*
Compute the Redis URL.
If externalRedis is enabled, use its URL; otherwise build from built-in Redis.
*/}}
{{- define "visiontest.redisUrl" -}}
{{- if .Values.externalRedis.enabled }}
{{- .Values.externalRedis.url }}
{{- else if .Values.secrets.redisPassword }}
{{- printf "redis://:%s@%s-redis:6379" .Values.secrets.redisPassword (include "visiontest.fullname" .) }}
{{- else }}
{{- printf "redis://%s-redis:6379" (include "visiontest.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Compute the MinIO endpoint.
If externalMinio is enabled, use its endpoint; otherwise use built-in.
*/}}
{{- define "visiontest.minioEndpoint" -}}
{{- if .Values.externalMinio.enabled }}
{{- .Values.externalMinio.endpoint }}
{{- else }}
{{- printf "%s-minio" (include "visiontest.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Compute the MinIO port.
*/}}
{{- define "visiontest.minioPort" -}}
{{- if .Values.externalMinio.enabled }}
{{- .Values.externalMinio.port | default 9000 }}
{{- else }}
{{- 9000 }}
{{- end }}
{{- end }}

{{/*
Name of the secrets resource.
*/}}
{{- define "visiontest.secretName" -}}
{{- printf "%s-secrets" (include "visiontest.fullname" .) }}
{{- end }}
