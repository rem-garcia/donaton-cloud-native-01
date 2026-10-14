import { ColaReciboService } from "@/src/service/colaReciboService";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const colaReciboService = new ColaReciboService();

// Compara en tiempo constante para no filtrar el secreto por diferencias de tiempo.
const autorizado = (request: NextRequest, secreto: string) => {
    const recibido = Buffer.from(request.headers.get("authorization") ?? "");
    const esperado = Buffer.from(`Bearer ${secreto}`);

    return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
};

// Consumidor de la cola 'donaciones_recibo'. Lo invoca pg_cron/pg_net cada minuto
// (ver prisma/sql/pg_cron_worker_donaciones.sql). Tambien puede llamarse a mano con curl.
export const POST = async (request: NextRequest) => {
    const secreto = process.env.WORKER_SECRET;

    if (!secreto) {
        return NextResponse.json({ error: "WORKER_SECRET no está configurado" }, { status: 503 });
    }

    if (!autorizado(request, secreto)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        const resumen = await colaReciboService.procesar();

        return NextResponse.json(resumen, { status: 200 });
    } catch (error) {
        const mensajeError = error instanceof Error ? error.message : "Error al procesar la cola";

        return NextResponse.json({ error: mensajeError }, { status: 500 });
    }
};