import { HttpError } from "./http.js";

function normalizeSupabaseUrl(value) {
  return String(value || "").replace(/\/$/, "").replace(/\/rest\/v1$/, "");
}

export function createDatabase(env) {
  const baseUrl = normalizeSupabaseUrl(env.SUPABASE_URL);
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceKey) {
    throw new HttpError(
      500,
      "Konfigurasi Supabase Worker belum lengkap.",
      "SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi."
    );
  }

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.prefer ? { Prefer: options.prefer } : {}),
        ...(options.range
          ? {
              Range: `${options.range.from}-${options.range.to}`,
              "Range-Unit": "items",
            }
          : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new HttpError(
        500,
        "Supabase request gagal.",
        payload?.message || payload?.hint || payload || response.statusText
      );
    }

    const contentRange = response.headers.get("content-range");
    const total = contentRange?.includes("/")
      ? Number(contentRange.split("/")[1])
      : null;

    return { data: payload, total: Number.isFinite(total) ? total : null };
  }

  return {
    async select(table, params = {}, options = {}) {
      const query = new URLSearchParams(params);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return request(`${table}${suffix}`, {
        range: options.range,
        prefer: options.count ? "count=exact" : undefined,
      });
    },

    async insert(table, body) {
      const result = await request(table, {
        method: "POST",
        body,
        prefer: "return=representation",
      });
      return Array.isArray(result.data) ? result.data[0] : result.data;
    },

    async upsert(table, body, onConflict) {
      const query = new URLSearchParams({ on_conflict: onConflict });
      const result = await request(`${table}?${query.toString()}`, {
        method: "POST",
        body,
        prefer: "resolution=merge-duplicates,return=representation",
      });
      return Array.isArray(result.data) ? result.data[0] : result.data;
    },

    async update(table, filters, body) {
      const query = new URLSearchParams(filters);
      const result = await request(`${table}?${query.toString()}`, {
        method: "PATCH",
        body,
        prefer: "return=representation",
      });
      return Array.isArray(result.data) ? result.data[0] : result.data;
    },

    async rpc(name, body = {}) {
      const result = await request(`rpc/${name}`, {
        method: "POST",
        body,
      });
      return result.data;
    },
  };
}

export async function authenticateOperator(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    throw new HttpError(401, "Sesi login tidak ditemukan.");
  }

  const baseUrl = normalizeSupabaseUrl(env.SUPABASE_URL);
  const anonKey = env.SUPABASE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new HttpError(500, "Konfigurasi autentikasi Worker belum lengkap.");
  }

  const userResponse = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  const user = await userResponse.json().catch(() => null);

  if (!userResponse.ok || !user?.id) {
    throw new HttpError(401, "Sesi login tidak valid atau sudah berakhir.");
  }

  const database = createDatabase(env);
  const employeeResult = await database.select("employees", {
    select: "id,name,role,status",
    id: `eq.${user.id}`,
    limit: "1",
  });
  const employee = employeeResult.data?.[0];
  const allowedRoles = String(env.SOCIAL_ALLOWED_ROLES || "Founder,Administrator")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  if (
    !employee ||
    employee.status !== "Aktif" ||
    !allowedRoles.includes(employee.role)
  ) {
    throw new HttpError(403, "Akun ini tidak memiliki akses Social Media.");
  }

  return { user, employee, database };
}
