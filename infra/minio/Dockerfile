# MinIO no publica ya imagenes en Docker Hub ni quay.io, asi que se compila
# desde fuente. Una sola imagen con `minio` (servidor) y `mc` (cliente, usado
# por minio-init para crear el bucket).
FROM golang:alpine AS build
ENV GOTOOLCHAIN=auto CGO_ENABLED=0
RUN go install github.com/minio/minio@latest \
 && go install github.com/minio/mc@latest

FROM alpine:3.20
RUN apk add --no-cache ca-certificates curl
COPY --from=build /go/bin/minio /go/bin/mc /usr/local/bin/
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
