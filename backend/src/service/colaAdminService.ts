import { z } from "zod";
import { COLAS, leerMensajes, archivarMensaje, reprogramarMensaje, moverADlq } from "../lib/queue";
import { enviarCorreo } from "../lib/mailer";

// Contrato del suscriptor "admin" para el evento donacion.creada
const adminMensajeSchema = z.object({
    donacionId: z.number(),
    correoDonante: z.string(),
    nombreDonante: z.string().nullish(),
    tipo: z.string(),
    cantidad: z.number(),
    peso: z.string(),
    creadoEn: z.string(),
});

type AdminMensaje = z.infer<typeof adminMensajeSchema>;

const VT_SEGUNDOS = 30;
const TAMANO_LOTE = 10;
const MAX_LOTES_POR_EJECUCION = 5;
const BACKOFF_BASE_SEGUNDOS = 30;
const BACKOFF_MAX_SEGUNDOS = 3600;

function maxReintentos(): number {
    const n = Number(process.env.QUEUE_MAX_RETRIES);
    return Number.isInteger(n) && n > 0 ? n : 3;
}

function backoffSegundos(intento: number): number {
    return Math.min(BACKOFF_BASE_SEGUNDOS * 2 ** (intento - 1), BACKOFF_MAX_SEGUNDOS);
}

function escapar(texto: string): string {
    return texto
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export interface ResumenAdmin {
    leidos: number;
    procesados: number;
    reintentos: number;
    enDlq: number;
}

export class ColaAdminService {
    async procesar(): Promise<ResumenAdmin> {
        const resumen: ResumenAdmin = { leidos: 0, procesados: 0, reintentos: 0, enDlq: 0 };
        const max = maxReintentos();

        for (let lote = 0; lote < MAX_LOTES_POR_EJECUCION; lote++) {
            const mensajes = await leerMensajes<unknown>(COLAS.adminDonacion, VT_SEGUNDOS, TAMANO_LOTE);
            if (mensajes.length === 0) break;

            for (const m of mensajes) {
                resumen.leidos++;

                // Reintentos ya agotados: reject -> DLQ
                if (m.readCt > max) {
                    await moverADlq(COLAS.adminDonacion, COLAS.adminDonacionDlq, m, `Reintentos agotados (${m.readCt - 1})`);
                    console.log(`[reject:admin] msg ${m.msgId} -> DLQ (reintentos agotados)`);
                    resumen.enDlq++;
                    continue;
                }

                // Mensaje invalido: reject directo a la DLQ
                const parsed = adminMensajeSchema.safeParse(m.message);
                if (!parsed.success) {
                    const motivo = `Mensaje invalido: ${parsed.error.issues[0]?.message ?? "payload"}`;
                    await moverADlq(COLAS.adminDonacion, COLAS.adminDonacionDlq, m, motivo);
                    console.log(`[reject:admin] msg ${m.msgId} -> DLQ (${motivo})`);
                    resumen.enDlq++;
                    continue;
                }

                try {
                    await this.notificarAdmin(parsed.data);
                    await archivarMensaje(COLAS.adminDonacion, m.msgId);
                    console.log(`[ack:admin] msg ${m.msgId} procesado y archivado`);
                    resumen.procesados++;
                } catch (error) {
                    const motivo = error instanceof Error ? error.message : String(error);

                    if (m.readCt >= max) {
                        await moverADlq(COLAS.adminDonacion, COLAS.adminDonacionDlq, m, `Fallo definitivo: ${motivo}`);
                        console.log(`[reject:admin] msg ${m.msgId} -> DLQ (${motivo})`);
                        resumen.enDlq++;
                    } else {
                        const espera = backoffSegundos(m.readCt);
                        await reprogramarMensaje(COLAS.adminDonacion, m.msgId, espera);
                        console.log(`[nack:admin] msg ${m.msgId} reintento en ${espera}s (${motivo})`);
                        resumen.reintentos++;
                    }
                }
            }
        }

        return resumen;
    }

    // Efecto del suscriptor: avisar al administrador de una nueva donacion
    private async notificarAdmin(d: AdminMensaje): Promise<void> {
        const detalle = `Nueva donacion #${d.donacionId}: ${d.cantidad} x ${d.tipo} (peso ${d.peso}) de ${d.nombreDonante ?? d.correoDonante}`;
        console.log(`[admin] ${detalle}`);

        const admin = process.env.ADMIN_EMAIL?.trim();
        if (!admin) return; // sin ADMIN_EMAIL solo se registra en el log

        await enviarCorreo({
            para: admin,
            asunto: `Nueva donacion #${d.donacionId} - Donaton`,
            texto: detalle,
            html: `<p>${escapar(detalle)}</p>`,
        });
    }
}