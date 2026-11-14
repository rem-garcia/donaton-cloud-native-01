import { prisma } from "@/src/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface FilaResumen {
    tipo: string;
    donaciones: number;
    cantidad_total: number;
    actualizado_en: Date;
}

interface FilaAlerta {
    msg_id: number;
    enqueued_at: Date;
    message: Record<string, unknown>;
}

// Estado del streaming de donaciones (cola donaciones_stream + Edge Function stream-donaciones).
// Las tablas estan fuera de Prisma, asi que se lee con $queryRaw.
export const GET = async () => {
    try {
        const [resumen, alertas, cola] = await Promise.all([
            prisma.$queryRaw<FilaResumen[]>`
                select tipo, donaciones, cantidad_total, actualizado_en
                from public.donaciones_resumen
                order by cantidad_total desc
            `,
            prisma.$queryRaw<FilaAlerta[]>`
                select msg_id::int as msg_id, enqueued_at, message
                from pgmq.q_donaciones_alertas
                order by msg_id desc
                limit 10
            `,
            prisma.$queryRaw<{ pendientes: number; procesados: number; edad_seg: number | null }[]>`
                select
                    (select count(*) from pgmq.q_donaciones_stream)::int as pendientes,
                    (select count(*) from pgmq.a_donaciones_stream)::int as procesados,
                    (select extract(epoch from now() - min(enqueued_at)) from pgmq.q_donaciones_stream)::float as edad_seg
            `,
        ]);

        return NextResponse.json({
            cola: {
                pendientes: cola[0].pendientes,
                procesados: cola[0].procesados,
                masAntiguoSeg: cola[0].edad_seg,
            },
            resumen: resumen.map((r) => ({
                tipo: r.tipo,
                donaciones: r.donaciones,
                cantidadTotal: r.cantidad_total,
                actualizadoEn: r.actualizado_en,
            })),
            alertas: alertas.map((a) => ({
                msgId: a.msg_id,
                creadoEn: a.enqueued_at,
                ...a.message,
            })),
        });
    } catch (error) {
        const mensaje = error instanceof Error ? error.message : "Error al leer el streaming";

        return NextResponse.json({ error: mensaje }, { status: 500 });
    }
};