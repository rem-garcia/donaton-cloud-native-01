import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
    COLAS,
    archivarMensaje,
    crearCola,
    eliminarCola,
    enviarMensaje,
    leerConEspera,
    leerMensajes,
} from "../lib/queue";

const PREFIJO_RESPUESTA = "rpc_resp_";
const VT_SEGUNDOS = 30;

interface Solicitud {
    correlationId: string;
    colaRespuesta: string;
    operacion: string;
}

interface Respuesta {
    correlationId: string;
    ok: boolean;
    datos?: unknown;
    error?: string;
}

export class SolicitudSincronaService {
    // Lado "servidor": lee solicitudes pendientes y publica la respuesta en la cola indicada.
    async responder() {
        const mensajes = await leerMensajes<Solicitud>(COLAS.solicitudes, VT_SEGUNDOS, 10);

        for (const mensaje of mensajes) {
            const { correlationId, colaRespuesta, operacion } = mensaje.message;

            // Solo se responde a colas temporales de este patron.
            if (typeof colaRespuesta === "string" && colaRespuesta.startsWith(PREFIJO_RESPUESTA)) {
                let respuesta: Respuesta;

                try {
                    respuesta = { correlationId, ok: true, datos: await this.ejecutar(operacion) };
                } catch (error) {
                    const motivo = error instanceof Error ? error.message : "Error al procesar";
                    respuesta = { correlationId, ok: false, error: motivo };
                }

                try {
                    await enviarMensaje(prisma, colaRespuesta, respuesta);
                } catch {
                    // El solicitante ya expiro y borro su cola de respuesta: no hay a quien responder.
                    console.warn(`[rpc] sin cola de respuesta para ${correlationId}`);
                }
            }

            await archivarMensaje(COLAS.solicitudes, mensaje.msgId);
            console.log(`[ack:rpc] solicitud ${correlationId} (${operacion})`);
        }

        return mensajes.length;
    }

    private async ejecutar(operacion: string) {
        if (operacion !== "resumen_donaciones") {
            throw new Error(`Operacion desconocida: ${operacion}`);
        }

        const grupos = await prisma.donacion.groupBy({
            by: ["tipo"],
            _count: { _all: true },
            _sum: { cantidad: true },
        });

        return {
            totalDonaciones: grupos.reduce((acc, g) => acc + g._count._all, 0),
            porTipo: grupos.map((g) => ({
                tipo: g.tipo,
                donaciones: g._count._all,
                cantidadTotal: g._sum.cantidad ?? 0,
            })),
        };
    }

    // Lado "cliente": envia la solicitud y BLOQUEA hasta recibir la respuesta (o agotar el tiempo).
    async solicitarResumen(timeoutSeg = 10) {
        const inicio = Date.now();
        const correlationId = randomUUID();
        const colaRespuesta = `${PREFIJO_RESPUESTA}${correlationId.replace(/-/g, "")}`;

        await crearCola(colaRespuesta);

        try {
            const solicitud: Solicitud = { correlationId, colaRespuesta, operacion: "resumen_donaciones" };
            await enviarMensaje(prisma, COLAS.solicitudes, solicitud);

            await this.responder();

            const respuestas = await leerConEspera<Respuesta>(colaRespuesta, VT_SEGUNDOS, 1, timeoutSeg);
            const respuesta = respuestas.find((r) => r.message.correlationId === correlationId);

            if (!respuesta) {
                throw new Error("Tiempo de espera agotado");
            }

            if (!respuesta.message.ok) {
                throw new Error(respuesta.message.error ?? "Error en el responder");
            }

            return {
                correlationId,
                tiempoMs: Date.now() - inicio,
                resumen: respuesta.message.datos,
            };
        } finally {
            await eliminarCola(colaRespuesta);
        }
    }
}