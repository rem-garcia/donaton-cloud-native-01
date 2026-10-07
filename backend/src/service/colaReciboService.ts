import z from "zod";
import { archivarMensaje, COLAS, leerMensajes, moverADlq, reprogramarMensaje, type MensajeCola } from "../lib/queue";
import { enviarCorreo, escaparHtml } from "../lib/mailer";

// Forma del mensaje que encola DonacionRepository.createDonacionConRecibo
const reciboMensajeSchema = z.object({
    donacionId: z.number(),
    correoDonante: z.email(),
    nombreDonante: z.string().nullable().optional(),
    tipo: z.string(),
    cantidad: z.number(),
    peso: z.string(),
    creadoEn: z.string(),
});

type ReciboMensaje = z.infer<typeof reciboMensajeSchema>;

const VT_SEGUNDOS = 30;             // tiempo maximo estimado para procesar un mensaje
const TAMANO_LOTE = 10;             // mensajes por lectura
const MAX_LOTES_POR_EJECUCION = 5;  // tope para no exceder el timeout de pg_net
const BACKOFF_MAX_SEGUNDOS = 3600;

const maxReintentos = () => {
    const valor = Number(process.env.QUEUE_MAX_RETRIES);
    return Number.isInteger(valor) && valor >= 1 ? valor : 3;
};

export interface ResumenProceso {
    leidos: number;
    enviados: number;
    reintentos: number;
    enDlq: number;
}

export class ColaReciboService {
    async procesar(): Promise<ResumenProceso> {
        const resumen: ResumenProceso = { leidos: 0, enviados: 0, reintentos: 0, enDlq: 0 };

        for (let i = 0; i < MAX_LOTES_POR_EJECUCION; i++) {
            const lote = await leerMensajes<unknown>(COLAS.reciboDonacion, VT_SEGUNDOS, TAMANO_LOTE);

            if (lote.length === 0) break;

            resumen.leidos += lote.length;

            for (const mensaje of lote) {
                await this.procesarMensaje(mensaje, resumen);
            }

            if (lote.length < TAMANO_LOTE) break;
        }

        return resumen;
    }

    private async procesarMensaje(mensaje: MensajeCola<unknown>, resumen: ResumenProceso) {
        const max = maxReintentos();

        // Mensaje que ya agoto sus intentos (por ejemplo, el worker murio a mitad de proceso).
        if (mensaje.readCt > max) {
            await moverADlq(COLAS.reciboDonacion, COLAS.reciboDonacionDlq, mensaje, "Reintentos agotados");
            resumen.enDlq++;
            return;
        }

        // Un mensaje con forma invalida nunca se va a poder procesar: reintentar no sirve.
        const parsed = reciboMensajeSchema.safeParse(mensaje.message);

        if (!parsed.success) {
            await moverADlq(
                COLAS.reciboDonacion,
                COLAS.reciboDonacionDlq,
                mensaje,
                `Mensaje invalido: ${parsed.error.issues[0]?.message}`
            );
            resumen.enDlq++;
            return;
        }

        try {
            await enviarCorreo(this.armarRecibo(parsed.data));
            await archivarMensaje(COLAS.reciboDonacion, mensaje.msgId);
            resumen.enviados++;
        } catch (error) {
            const motivo = error instanceof Error ? error.message : String(error);

            console.error(`[cola-recibo] msg ${mensaje.msgId} fallo (intento ${mensaje.readCt}/${max}): ${motivo}`);

            if (mensaje.readCt >= max) {
                await moverADlq(COLAS.reciboDonacion, COLAS.reciboDonacionDlq, mensaje, motivo);
                resumen.enDlq++;
                return;
            }

            // Backoff exponencial: 30s, 60s, 120s... (tope 1 hora)
            const espera = Math.min(VT_SEGUNDOS * 2 ** (mensaje.readCt - 1), BACKOFF_MAX_SEGUNDOS);

            await reprogramarMensaje(COLAS.reciboDonacion, mensaje.msgId, espera);
            resumen.reintentos++;
        }
    }

    private armarRecibo(d: ReciboMensaje) {
        const nombre = d.nombreDonante?.trim() || "donante";
        const resumenTexto = `${d.cantidad} x ${d.tipo} (${d.peso} kg)`;

        return {
            para: d.correoDonante,
            asunto: `Gracias por tu donación #${d.donacionId} - Donaton`,
            texto:
                `Hola ${nombre},\n\n` +
                `Registramos tu donación #${d.donacionId}: ${resumenTexto}.\n` +
                `¡Gracias por ayudar a quienes más lo necesitan!\n\nEquipo Donaton`,
            html:
                `<p>Hola ${escaparHtml(nombre)},</p>` +
                `<p>Registramos tu donación <strong>#${d.donacionId}</strong>: ${escaparHtml(resumenTexto)}.</p>` +
                `<p>¡Gracias por ayudar a quienes más lo necesitan!</p><p>Equipo Donaton</p>`,
        };
    }
}