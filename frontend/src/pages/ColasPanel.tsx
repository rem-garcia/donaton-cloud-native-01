/**
 * @module pages/ColasPanel
 * @author Remi Garcia, Benjamin Llanquiman y Ricardo Diaz
 * @description Monitoreo de colas de mensajes (pgmq) para el Admin.
 *
 * Comunicación con el backend:
 * - GET /api/admin/colas → métricas de todas las colas.
 * - GET /api/admin/colas/detalle?cola= → mensajes pendientes y procesados de una cola.
 * - GET /api/admin/alertas → alertas pendientes. DELETE ?id= → confirmar.
 * - GET /api/admin/colas/dlq?cola= → mensajes de una DLQ. DELETE → purgar.
 * - POST /api/admin/colas/dlq/reprocesar → devuelve un mensaje a su cola de origen.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import PanelHeader from "../components/PanelHeader";
import type { Alerta, DetalleCola, MensajeCola, MensajeDlq, MetricaCola } from "../dtos/colaResponseDto";

const API_URL = import.meta.env.VITE_API_URL;

// Deben coincidir con las DLQS de gestionColasService.ts
const DLQS = ["donaciones_recibo_dlq", "donaciones_admin_dlq"];

// Nombres amigables para mostrar (el nombre real se sigue usando para las peticiones)
const NOMBRES_COLAS: Record<string, { nombre: string; descripcion: string }> = {
    donaciones_recibo:     { nombre: "Recibos de donación",     descripcion: "Envío de correos de recibo" },
    donaciones_recibo_dlq: { nombre: "Recibos fallidos",        descripcion: "Recibos que no se pudieron enviar" },
    donaciones_admin:      { nombre: "Avisos al administrador", descripcion: "Notificaciones de nuevas donaciones" },
    donaciones_admin_dlq:  { nombre: "Avisos fallidos",         descripcion: "Avisos que no se pudieron procesar" },
    alertas_sistema:       { nombre: "Alertas del sistema",     descripcion: "Avisos de mensajes con error" },
    rpc_solicitudes:       { nombre: "Solicitudes síncronas",   descripcion: "Consultas que esperan respuesta" },
};

const nombreCola = (cola: string) => NOMBRES_COLAS[cola]?.nombre ?? cola;
const descripcionCola = (cola: string) => NOMBRES_COLAS[cola]?.descripcion ?? "";

const formatearSeg = (seg: number | null) => {
    if (seg === null) return "—";
    if (seg < 60) return `${Math.round(seg)} s`;
    if (seg < 3600) return `${Math.round(seg / 60)} min`;
    return `${(seg / 3600).toFixed(1)} h`;
};

const formatearFecha = (fecha: string) => new Date(fecha).toLocaleString("es-CL");

// Nombres legibles para los campos de los mensajes
const ETIQUETAS: Record<string, string> = {
    donacionId: "N° de donación",
    nombreDonante: "Donante",
    correoDonante: "Correo",
    tipo: "Tipo",
    cantidad: "Cantidad",
    peso: "Peso",
    creadoEn: "Fecha",
    motivo: "Motivo",
    origen: "Origen",
    dlq: "Cola de fallidos",
    msgIdOriginal: "N° de mensaje original",
    intentos: "Intentos",
    movidoEn: "Movido el",
    operacion: "Operación",
    correlationId: "ID de solicitud",
};

// Si un campo no está en ETIQUETAS: "fechaEntrega" → "Fecha entrega"
const etiqueta = (clave: string) =>
    ETIQUETAS[clave] ??
    clave.replace(/([A-Z])/g, " $1").toLowerCase().replace(/^./, (c) => c.toUpperCase());

const formatearValor = (clave: string, valor: unknown): string => {
    if (valor === null || valor === undefined || valor === "") return "—";
    if (typeof valor === "boolean") return valor ? "Sí" : "No";
    if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}T/.test(valor)) return formatearFecha(valor);
    if ((clave === "origen" || clave === "dlq") && typeof valor === "string") return nombreCola(valor);
    if (Array.isArray(valor)) return valor.map((v) => formatearValor(clave, v)).join(", ");
    return String(valor);
};

// Muestra el contenido de un mensaje como lista de campos (sin JSON)
function ContenidoMensaje({ datos }: { datos: unknown }) {
    if (datos === null || typeof datos !== "object" || Array.isArray(datos)) {
        return <p className="text-sm text-gray-600 mt-1">{formatearValor("", datos)}</p>;
    }

    return (
        <div className="bg-gray-50 rounded-lg p-3 mt-1 flex flex-col gap-1 text-sm">
            {Object.entries(datos as Record<string, unknown>).map(([clave, valor]) =>
                valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (
                    <div key={clave} className="flex flex-col">
                        <span className="text-gray-500">{etiqueta(clave)}</span>
                        <ContenidoMensaje datos={valor} />
                    </div>
                ) : (
                    <div key={clave} className="flex justify-between gap-4">
                        <span className="text-gray-500">{etiqueta(clave)}</span>
                        <span className="text-navy font-medium text-right break-all">
                            {formatearValor(clave, valor)}
                        </span>
                    </div>
                )
            )}
        </div>
    );
}
interface ResumenSincrono {
    correlationId: string;
    tiempoMs: number;
    resumen: {
        totalDonaciones: number;
        porTipo: { tipo: string; donaciones: number; cantidadTotal: number }[];
    };
}
async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${ruta}`, { credentials: "include", ...opciones });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? data.mensaje ?? "Error en la petición");
    return data;
}

export default function ColasPanel() {
    
    const [metricas, setMetricas] = useState<MetricaCola[]>([]);
    const [alertas, setAlertas] = useState<MensajeCola<Alerta>[]>([]);
    const [dlq, setDlq] = useState(DLQS[0]);
    const [mensajesDlq, setMensajesDlq] = useState<MensajeCola<MensajeDlq>[]>([]);
    const [colaAbierta, setColaAbierta] = useState<string | null>(null);
    const [detalle, setDetalle] = useState<DetalleCola | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cargando, setCargando] = useState(true);
    const [sincrona, setSincrona] = useState<ResumenSincrono | null>(null);
    const [esperando, setEsperando] = useState(false);

    const navigate = useNavigate();

    const cargarTodo = async () => {
        try {
            const [m, a, d] = await Promise.all([
                pedir<MetricaCola[]>("/api/admin/colas"),
                pedir<MensajeCola<Alerta>[]>("/api/admin/alertas"),
                pedir<MensajeCola<MensajeDlq>[]>(`/api/admin/colas/dlq?cola=${dlq}`),
            ]);
            // Se ocultan las colas temporales de respuesta (rpc_resp_...)
            setMetricas(m.filter((cola) => !cola.cola.startsWith("rpc_resp_")));
            setAlertas(a);
            setMensajesDlq(d);

            // Si hay una cola abierta, también se refresca su detalle
            if (colaAbierta) {
                setDetalle(await pedir<DetalleCola>(`/api/admin/colas/detalle?cola=${colaAbierta}`));
            }
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al cargar las colas");
        } finally {
            setCargando(false);
        }
    };

    // Carga al entrar, al cambiar de DLQ o de cola abierta, y se refresca cada 10 segundos
    useEffect(() => {
        cargarTodo();
        const intervalo = setInterval(cargarTodo, 10000);
        return () => clearInterval(intervalo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dlq, colaAbierta]);

    const alternarDetalle = (cola: string) => {
        setDetalle(null);
        setColaAbierta(colaAbierta === cola ? null : cola);
    };

    const reprocesar = async (msgId: number) => {
        try {
            await pedir("/api/admin/colas/dlq/reprocesar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cola: dlq, msgId }),
            });
            cargarTodo();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al reprocesar");
        }
    };

    const purgar = async () => {
        if (!confirm(`¿Eliminar todos los mensajes de "${nombreCola(dlq)}"? No se puede deshacer.`)) return;
        try {
            await pedir(`/api/admin/colas/dlq?cola=${dlq}`, { method: "DELETE" });
            cargarTodo();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al purgar");
        }
    };

    const confirmarAlerta = async (msgId: number) => {
        try {
            await pedir(`/api/admin/alertas?id=${msgId}`, { method: "DELETE" });
            cargarTodo();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al confirmar la alerta");
        }
    };

        const pedirResumenSincrono = async () => {
        setEsperando(true);
        setSincrona(null);
        try {
            setSincrona(await pedir<ResumenSincrono>("/api/admin/sincrono/resumen-donaciones"));
            cargarTodo();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error en la petición síncrona");
        } finally {
            setEsperando(false);
        }
    };

    const metricaAbierta = metricas.find((m) => m.cola === colaAbierta);

    return (
        <div className="min-h-screen bg-gray-100 px-6 py-10">
            <div className="max-w-6xl mx-auto flex flex-col gap-8">
                <PanelHeader
                    titulo="Colas de mensajes"
                    subtitulo="Estado de las colas, alertas y mensajes fallidos."
                />

                <button
                    onClick={() => navigate("/admin-dashboard")}
                    className="self-start text-sm text-gray-500 hover:text-navy cursor-pointer"
                >
                    ← Volver al panel
                </button>

                {error && (
                    <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
                )}

                {/* Métricas por cola */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold text-navy">Colas</h2>
                    {cargando ? (
                        <p className="text-sm text-gray-500">Cargando...</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {metricas.map((m) => {
                                const esDlq = m.cola.endsWith("_dlq");
                                const conProblema = esDlq && m.largo > 0;
                                const abierta = colaAbierta === m.cola;
                                return (
                                    <div
                                        key={m.cola}
                                        onClick={() => alternarDetalle(m.cola)}
                                        className={`group bg-white rounded-2xl shadow-sm border p-6 flex flex-col gap-2
                                            cursor-pointer hover:shadow-md transition-all duration-200 ${
                                            abierta
                                                ? "border-teal ring-2 ring-teal/20"
                                                : conProblema ? "border-red-200" : "border-gray-100 hover:border-teal"
                                        }`}
                                    >
                                        <span className="font-semibold text-navy">{nombreCola(m.cola)}</span>
                                        <span className="text-xs text-gray-400">{descripcionCola(m.cola)}</span>
                                        <span className={`text-3xl font-bold ${conProblema ? "text-red-600" : "text-navy"}`}>
                                            {m.largo}
                                        </span>
                                        <span className="text-sm text-gray-500">mensajes en cola</span>
                                        <span className="text-xs text-teal mt-1">
                                            {abierta ? "Ocultar detalles ▲" : "Ver detalles ▼"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Detalle de la cola seleccionada */}
                    {colaAbierta && (
                        <div className="bg-white rounded-2xl shadow-sm border border-teal/40 p-6 flex flex-col gap-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex flex-col">
                                    <span className="text-lg font-semibold text-navy">{nombreCola(colaAbierta)}</span>
                                    <span className="text-sm text-gray-500">{descripcionCola(colaAbierta)}</span>
                                </div>
                                <button
                                    onClick={() => alternarDetalle(colaAbierta)}
                                    className="text-sm text-gray-400 hover:text-navy cursor-pointer"
                                >
                                    Cerrar ✕
                                </button>
                            </div>

                            {/* Resumen */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {[
                                    { label: "En cola", valor: metricaAbierta?.largo ?? "—" },
                                    { label: "Procesados", valor: detalle?.totalProcesados ?? "..." },
                                    { label: "Total histórico", valor: metricaAbierta?.totalHistorico ?? "—" },
                                    { label: "Más nuevo", valor: formatearSeg(metricaAbierta?.masNuevoSeg ?? null) },
                                    { label: "Más antiguo", valor: formatearSeg(metricaAbierta?.masAntiguoSeg ?? null) },
                                ].map((dato) => (
                                    <div key={dato.label} className="bg-gray-50 rounded-xl p-3 flex flex-col">
                                        <span className="text-xs text-gray-400">{dato.label}</span>
                                        <span className="text-lg font-semibold text-navy">{dato.valor}</span>
                                    </div>
                                ))}
                            </div>

                            {!detalle ? (
                                <p className="text-sm text-gray-500">Cargando detalle...</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Pendientes */}
                                    <div className="flex flex-col gap-2">
                                        <h3 className="font-semibold text-navy text-sm">
                                            Pendientes ({detalle.pendientes.length})
                                        </h3>
                                        {detalle.pendientes.length === 0 ? (
                                            <p className="text-sm text-gray-500">No hay mensajes pendientes.</p>
                                        ) : (
                                            detalle.pendientes.map((p) => (
                                                <div key={p.msgId} className="border border-gray-100 rounded-xl p-3 text-sm">
                                                    <div className="flex justify-between text-xs text-gray-400">
                                                        <span>#{p.msgId} · intentos: {p.intentos}</span>
                                                        <span>{formatearFecha(p.encoladoEn)}</span>
                                                    </div>
                                                    <details className="mt-1">
                                                        <summary className="text-xs text-teal cursor-pointer">Ver datos</summary>
                                                        <ContenidoMensaje datos={p.mensaje} />
                                                    </details>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Últimos procesados */}
                                    <div className="flex flex-col gap-2">
                                        <h3 className="font-semibold text-navy text-sm">
                                            Últimos procesados ({detalle.procesados.length})
                                        </h3>
                                        {detalle.procesados.length === 0 ? (
                                            <p className="text-sm text-gray-500">Aún no hay mensajes procesados.</p>
                                        ) : (
                                            detalle.procesados.map((p) => (
                                                <div key={p.msgId} className="border border-gray-100 rounded-xl p-3 text-sm">
                                                    <div className="flex justify-between text-xs text-gray-400">
                                                        <span>#{p.msgId} · intentos: {p.intentos}</span>
                                                        <span>Procesado: {formatearFecha(p.archivadoEn)}</span>
                                                    </div>
                                                    <details className="mt-1">
                                                        <summary className="text-xs text-teal cursor-pointer">Ver datos</summary>
                                                        <ContenidoMensaje datos={p.mensaje} />
                                                    </details>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Alertas */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold text-navy">Alertas ({alertas.length})</h2>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
                        {alertas.length === 0 ? (
                            <p className="p-6 text-sm text-gray-500">No hay alertas pendientes.</p>
                        ) : (
                            alertas.map((a) => (
                                <div key={a.msgId} className="p-4 flex items-center justify-between gap-4">
                                    <div className="flex flex-col text-sm">
                                        <span className="font-semibold text-navy">
                                            Mensaje fallido en {nombreCola(a.mensaje.dlq)}
                                        </span>
                                        <span className="text-gray-500">{a.mensaje.motivo}</span>
                                        <span className="text-xs text-gray-400">
                                            {formatearFecha(a.mensaje.creadoEn)} · origen: {nombreCola(a.mensaje.origen)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => confirmarAlerta(a.msgId)}
                                        className="text-sm px-3 py-1.5 rounded-lg bg-teal/10 text-teal hover:bg-teal hover:text-white transition-colors cursor-pointer"
                                    >
                                        Confirmar
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                                {/* Petición síncrona (request/reply) */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold text-navy">Petición síncrona</h2>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <p className="text-sm text-gray-500">
                                Envía una solicitud por la cola y espera la respuesta en la misma llamada.
                            </p>
                            <button
                                onClick={pedirResumenSincrono}
                                disabled={esperando}
                                className="text-sm px-3 py-1.5 rounded-lg bg-teal/10 text-teal hover:bg-teal hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {esperando ? "Esperando respuesta..." : "Pedir resumen de donaciones"}
                            </button>
                        </div>

                        {sincrona && (
                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="bg-gray-50 rounded-xl p-3 flex flex-col">
                                        <span className="text-xs text-gray-400">ID de solicitud</span>
                                        <span className="text-sm font-semibold text-navy break-all">{sincrona.correlationId}</span>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-3 flex flex-col">
                                        <span className="text-xs text-gray-400">Tiempo de respuesta</span>
                                        <span className="text-lg font-semibold text-navy">{sincrona.tiempoMs} ms</span>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-3 flex flex-col">
                                        <span className="text-xs text-gray-400">Total de donaciones</span>
                                        <span className="text-lg font-semibold text-navy">{sincrona.resumen.totalDonaciones}</span>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1 text-sm">
                                    {sincrona.resumen.porTipo.map((t) => (
                                        <div key={t.tipo} className="flex justify-between gap-4">
                                            <span className="text-gray-500">{t.tipo}</span>
                                            <span className="text-navy font-medium">
                                                {t.donaciones} donaciones · cantidad {t.cantidadTotal}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mensajes fallidos (DLQ) */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h2 className="text-lg font-semibold text-navy">Mensajes fallidos</h2>
                        <div className="flex items-center gap-2">
                            <select
                                value={dlq}
                                onChange={(e) => setDlq(e.target.value)}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
                            >
                                {DLQS.map((d) => (
                                    <option key={d} value={d}>{nombreCola(d)}</option>
                                ))}
                            </select>
                            <button
                                onClick={purgar}
                                disabled={mensajesDlq.length === 0}
                                className="text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Purgar
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
                        {mensajesDlq.length === 0 ? (
                            <p className="p-6 text-sm text-gray-500">No hay mensajes fallidos.</p>
                        ) : (
                            mensajesDlq.map((m) => (
                                <div key={m.msgId} className="p-4 flex items-start justify-between gap-4">
                                    <div className="flex flex-col text-sm gap-1 min-w-0 flex-1">
                                        <span className="font-semibold text-navy">
                                            #{m.msgId} · {m.mensaje.motivo}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            Movido: {formatearFecha(m.mensaje.movidoEn)} · intentos: {m.mensaje.intentos} · origen: {nombreCola(m.mensaje.origen)}
                                        </span>
                                        <ContenidoMensaje datos={m.mensaje.original} />
                                    </div>
                                    <button
                                        onClick={() => reprocesar(m.msgId)}
                                        className="shrink-0 text-sm px-3 py-1.5 rounded-lg bg-teal/10 text-teal hover:bg-teal hover:text-white transition-colors cursor-pointer"
                                    >
                                        Reprocesar
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}