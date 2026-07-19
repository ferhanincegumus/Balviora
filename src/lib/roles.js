// Role helpers for multi-tenant accounts.
// Owner-operator = full app (mobile-first). Dispatcher = company ops dashboard.
// Driver = mobile-only lite mode. Legacy "admin"/"user" map to owner_operator.
export function roleOf(user) {
  const r = user?.role;
  if (r === "dispatcher") return "dispatcher";
  if (r === "driver") return "driver";
  return "owner_operator";
}

export function roleHome(role) {
  if (role === "dispatcher") return "/dispatch";
  if (role === "driver") return "/driver";
  return "/dashboard";
}