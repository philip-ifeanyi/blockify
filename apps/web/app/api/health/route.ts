/** Liveness probe for the container health check (and any load balancer in front of it). */
export function GET() {
  return Response.json({ ok: true });
}
