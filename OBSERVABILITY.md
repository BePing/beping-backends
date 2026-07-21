# Observability

## Production topology

Prometheus, Grafana, Loki and the blackbox exporter run on the central Escape
Key platform node. Their host ports bind only to its Tailscale address.

Every application VPS runs Grafana Alloy with node-exporter and cAdvisor:

- node-exporter covers host CPU, memory, filesystem and network metrics;
- cAdvisor covers every running Docker container;
- Alloy forwards metrics to the central Prometheus remote-write receiver and
  Docker logs to Loki.

The BePing applications additionally expose Prometheus metrics on internal port
`9464`:

| Service | Metrics |
| --- | --- |
| API | Node.js/process defaults, HTTP request count and duration |
| Notifications | Node.js/process defaults, HTTP request count and duration |
| Importer | Node.js/process defaults |

`9464` is not an application or health-check port. Do not add a public Coolify
domain or host port for it.

## Alloy application discovery

The Alloy service on the BePing VPS must join both its own Compose network and
the external `coolify` network so that it can reach application containers:

```yaml
services:
  alloy:
    networks:
      - default
      - coolify

networks:
  coolify:
    external: true
```

Add this pipeline to the existing Alloy configuration. It discovers only the
three BePing images and only their exposed metrics port, so HTTP application
ports are never scraped accidentally.

```alloy
discovery.relabel "beping_applications" {
  targets = discovery.docker.local.targets

  rule {
    source_labels = ["__meta_docker_port_private"]
    action        = "keep"
    regex         = "9464"
  }

  rule {
    source_labels = ["__meta_docker_container_image"]
    action        = "keep"
    regex         = ".*/beping-(api|notifications|importer):.*"
  }

  rule {
    source_labels = ["__meta_docker_container_image"]
    regex         = ".*/(beping-(api|notifications|importer)):.*"
    target_label  = "service"
    replacement   = "$1"
  }

  rule {
    target_label = "host"
    replacement  = sys.env("ALLOY_HOST")
  }

  rule {
    target_label = "environment"
    replacement  = sys.env("ALLOY_ENVIRONMENT")
  }
}

prometheus.scrape "beping_applications" {
  targets         = discovery.relabel.beping_applications.output
  job_name        = "beping-applications"
  metrics_path    = "/metrics"
  scrape_interval = "15s"
  scrape_timeout  = "5s"
  forward_to      = [prometheus.remote_write.central.receiver]
}
```

Validate the complete Alloy file before redeploying:

```sh
alloy validate /etc/alloy/config.alloy
```

## Verification

After deploying immutable images for all three applications, verify locally
from the Alloy container and then query central Prometheus:

```promql
up{host="beping-backend", job="beping-applications"}
```

The result must contain exactly three healthy targets. Confirm application
telemetry separately:

```promql
count by (service) ({host="beping-backend", __name__=~"beping_.+"})
rate(beping_http_requests_total{host="beping-backend"}[5m])
histogram_quantile(0.95, sum by (le, service) (
  rate(beping_http_request_duration_seconds_bucket{host="beping-backend"}[5m])
))
```

The metrics listener also exposes `/-/healthy`, but the existing application
health checks remain authoritative for deployment readiness.
