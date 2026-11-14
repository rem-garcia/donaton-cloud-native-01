/**
 * @module pages/StreamPanel
 * @description Panel del streaming de donaciones (pgmq + Edge Function) para el Admin.
 *
 * Comunicación con el backend:
 * - GET /api/admin/stream → estado de la cola, resumen por tipo y alertas.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import PanelHeader from "../components/PanelHeader";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface EstadoStream {
    cola: { pendientes: number; procesados: number; masAntiguoSeg: number | null };
    resumen: { tipo: string; donaciones: number; cantidadTotal: number; actualizadoEn: string }[];
    alertas: { msgId: number; creadoEn: string; tipo?: string; donacionId?: number; donacionTipo?: string; cantidad?: number }[];
}

const formatearFecha = (fecha: string) => new Date(fecha).toLocaleString("es-CL");

const TITULO_ALERTA: Record<string, string> = {
    DONACION_INUSUAL: "Donación inusual",
    EVENTO_INVALIDO: "Evento inválido descartado",
};

export default function StreamPanel() {
    const [estado, setEstado] = useState<EstadoStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ultima, setUltima] = useState<Date | null>(null);
    const navigate = useNavigate();

    const cargar = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/stream`, { credentials: "include" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? data.mensaje ?? "Error en la petición");
            setEstado(data);
            setUltima(new Date());
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al cargar el streaming");
        }
    };

    // Se refresca cada 5 segundos para ver el flujo casi en tiempo real
    useEffect(() => {
        cargar();
        const intervalo = setInterval(cargar, 5000);
        return () => clearInterval(intervalo);
    }, []);

    const totalDonaciones = estado?.resumen.reduce((s, r) => s + r.donaciones, 0) ?? 0;
    const totalUnidades = estado?.resumen.reduce((s, r) => s + r.cantidadTotal, 0) ?? 0;

    return (
        <div className="min-h-screen bg-gray-100 px-6 py-10">
            <div className="max-w-6xl mx-auto flex flex-col gap-8">
                <PanelHeader
                    titulo="Streaming de donaciones"
                    subtitulo="Eventos procesados en tiempo real: totales por tipo y alertas."
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

                {/* Estado del flujo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Eventos en cola", valor: estado?.cola.pendientes ?? "—", ayuda: "pendientes de procesar" },
                        { label: "Eventos procesados", valor: estado?.cola.procesados ?? "—", ayuda: "confirmados (ack)" },
                        { label: "Donaciones agregadas", valor: estado ? totalDonaciones : "—", ayuda: "en el resumen" },
                        { label: "Unidades totales", valor: estado ? totalUnidades : "—", ayuda: "suma de cantidades" },
                    ].map((d) => (
                        <div key={d.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
                            <span className="text-sm text-gray-500">{d.label}</span>
                            <span className="text-3xl font-bold text-navy">{d.valor}</span>
                            <span className="text-xs text-gray-400">{d.ayuda}</span>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Resumen por tipo */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-3">
                        <h2 className="text-lg font-semibold text-navy">Totales por tipo</h2>
                        {!estado || estado.resumen.length === 0 ? (
                            <p className="text-sm text-gray-500">Aún no hay donaciones procesadas.</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 text-xs">
                                        <th className="py-1">Tipo</th>
                                        <th className="py-1 text-right">Donaciones</th>
                                        <th className="py-1 text-right">Cantidad total</th>
                                        <th className="py-1 text-right">Actualizado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estado.resumen.map((r) => (
                                        <tr key={r.tipo} className="border-t border-gray-100">
                                            <td className="py-2 font-medium text-navy">{r.tipo}</td>
                                            <td className="py-2 text-right">{r.donaciones}</td>
                                            <td className="py-2 text-right font-semibold">{r.cantidadTotal}</td>
                                            <td className="py-2 text-right text-xs text-gray-400">
                                                {new Date(r.actualizadoEn).toLocaleTimeString("es-CL")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Alertas del stream */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-3">
                        <h2 className="text-lg font-semibold text-navy">Alertas detectadas</h2>
                        {!estado || estado.alertas.length === 0 ? (
                            <p className="text-sm text-gray-500">Sin alertas.</p>
                        ) : (
                            estado.alertas.map((a) => (
                                <div key={a.msgId} className="border border-amber-200 bg-amber-50 rounded-xl p-3 text-sm">
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>#{a.msgId}</span>
                                        <span>{formatearFecha(a.creadoEn)}</span>
                                    </div>
                                    <p className="font-semibold text-navy">
                                        {TITULO_ALERTA[a.tipo ?? ""] ?? a.tipo}
                                    </p>
                                    {a.cantidad !== undefined && (
                                        <p className="text-gray-600">
                                            Donación #{a.donacionId}: {a.cantidad} × {a.donacionTipo}
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <p className="text-xs text-gray-400">
                    Se actualiza cada 5 segundos
                    {ultima ? ` · última lectura ${ultima.toLocaleTimeString("es-CL")}` : ""}
                    {estado?.cola.masAntiguoSeg != null
                        ? ` · evento más antiguo en cola: ${Math.round(estado.cola.masAntiguoSeg)} s`
                        : ""}
                </p>
            </div>
        </div>
    );
}