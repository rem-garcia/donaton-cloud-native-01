import { NextRequest, NextResponse } from "next/server";
import { verificarToken } from "./src/lib/jwt";
import { Rol } from "@/prisma/generated/prisma/enums";

const allowedOrigins = ["http://localhost:5173"];

const corsOptions = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
};

const rutasPublicas = [
    "/api/auth/login",
    "/api/auth/logout",
    "/api/worker",
];

// Reglas de autorizacion: si la ruta+metodo matchea, solo esos roles pueden pasar
const reglasPorRol: { pattern: string; methods?: string[]; roles: Rol[] }[] = [
    { pattern: "/api/usuarios", roles: [Rol.ADMIN] },
    { pattern: "/api/admin", roles: [Rol.ADMIN] },
    { pattern: "/api/necesidades", methods: ["POST", "PUT", "DELETE"], roles: [Rol.ADMIN, Rol.COLABORADOR] },
    { pattern: "/api/donaciones", methods: ["DELETE"], roles: [Rol.ADMIN] },
];

function obtenerRegla(pathname: string, method: string) {
    return reglasPorRol.find(
        (regla) =>
            pathname.startsWith(regla.pattern) &&
            (!regla.methods || regla.methods.includes(method))
    );
}

export const proxy = (request: NextRequest) => {
    const origin = request.headers.get("origin") ?? "";
    const isAllowedOrigin = allowedOrigins.includes(origin);

    if (request.method === "OPTIONS") {
        const preflightHeaders = {
            ...(isAllowedOrigin && { "Access-Control-Allow-Origin": origin }),
            ...corsOptions,
        };
        return NextResponse.json({}, { headers: preflightHeaders });
    }

    const pathname = request.nextUrl.pathname;
    const esRutaPublica = rutasPublicas.some((ruta) => pathname.startsWith(ruta));

    if (!esRutaPublica) {
        const token = request.cookies.get("token")?.value;

        if (!token) {
            return NextResponse.json({ mensaje: "No autenticado" }, { status: 401 });
        }

        try {
            const usuario = verificarToken(token);

            // --- Autorizacion por rol ---
            const regla = obtenerRegla(pathname, request.method);
            if (regla && !regla.roles.includes(usuario.rol)) {
                return NextResponse.json(
                    { mensaje: "No tiene permisos para realizar esta acción" },
                    { status: 403 }
                );
            }

            const requestHeaders = new Headers(request.headers);
            requestHeaders.set("x-usuario-id", String(usuario.id));
            requestHeaders.set("x-usuario-rol", usuario.rol);

            const response = NextResponse.next({ request: { headers: requestHeaders } });

            if (isAllowedOrigin) response.headers.set("Access-Control-Allow-Origin", origin);
            Object.entries(corsOptions).forEach(([key, value]) => response.headers.set(key, value));

            return response;
        } catch {
            return NextResponse.json({ mensaje: "Token inválido o expirado" }, { status: 401 });
        }
    }

    const response = NextResponse.next();
    if (isAllowedOrigin) response.headers.set("Access-Control-Allow-Origin", origin);
    Object.entries(corsOptions).forEach(([key, value]) => response.headers.set(key, value));

    return response;
};

export const config = {
    matcher: "/api/:path*"
};