function validTenantId(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value;
}

export function canReadDocument(user, document) {
  if (!user || !document) return false;

  return validTenantId(user.tenantId) &&
    validTenantId(document.tenantId) &&
    user.tenantId === document.tenantId;
}
