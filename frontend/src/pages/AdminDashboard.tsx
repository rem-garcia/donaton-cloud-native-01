/**
 * @module pages/AdminDashboard
 * @author Remi Garcia, Benjamin Llanquiman y Ricardo Diaz
 * @description Página principal del panel de administración de Donaton.
 *
 * Esta página es accesible exclusivamente para el actor Admin. Muestra 
 * una vista general del estado del sistema con métricas en tiempo real
 * y accesos directos a las secciones de gestión administrativa.
 *
 * Métricas que se muestran:
 * - Total de donaciones registradas en el sistema.
 * - Total de necesidades registradas.
 * - Total de usuarios internos registrados.
 *
 * Accesos directos disponibles:
 * - Gestion de usuarios
 * - Colas de mensajes
 *
 * Comunicación con el backend:
 * - GET /api/donaciones → lista completa de donaciones.
 * - GET /api/necesidades → lista total de necesidades.
 * - GET /api/usuarios → lista de usuarios para mostrar el total del sistema.
 * Las tres peticiones se lanzan en paralelo al cargar la página para reducir el tiempo de espera.
 */

import { useEffect, useState } from "react";
import { type DonacionResponse } from "../dtos/donacionResponseDto";
import { type NecesidadResponse } from "../dtos/necesidadResponseDto";
import { type UsuarioResponse } from "../dtos/usuarioResponseDto";
import { useNavigate } from "react-router";
import PanelHeader from "../components/PanelHeader";

/**
 * Panel de administración del sistema Donaton.
 * Carga donaciones, necesidades y usuarios en paralelo al montar el componente,
 * calcula las métricas del sistema y las presenta en tarjetas visuales.
 * Mientras los datos cargan, muestra '...' en lugar de los números.
 *
 * @returns Página completa con tarjetas de métricas y accesos a gestión.
 */
export default function AdminDashboard () {
    const [ donaciones, setDonaciones ] = useState<DonacionResponse[]>([]);
    const [ necesidades, setNecesidades ] = useState<NecesidadResponse[]>([]);
    const [ usuarios, setUsuarios] = useState<UsuarioResponse[]>([]);

    const navigate = useNavigate();

    // Se realizan tres peticiones (request) al backend con
    // Promise.all(). Como son asincronas, se realizan al mismo tiempo.
    useEffect(() => {
        Promise.all([
            fetch("http://localhost:3000/api/donaciones", { credentials: "include" }).then((response) => response.json()),
            fetch("http://localhost:3000/api/necesidades", { credentials: "include" }).then((response) => response.json()),
            fetch("http://localhost:3000/api/usuarios", { credentials: "include" }).then((response) => response.json())
        ])
        .then(([donacion, necesidad, usuario]) => {
            setDonaciones(donacion)
            setNecesidades(necesidad)
            setUsuarios(usuario)
        })
        .catch((error) => console.error("Error al cargar los datos:", error))
    }, []);

    // Cantidades
    const totalDonaciones = donaciones.length;
    const totalNecesidades = necesidades.length;
    const totalUsuarios = usuarios.length;

    // Metricas principales
    const metricas = [
        {
            label: "Total de donaciones",
            valor: totalDonaciones,
            color: "bg-blue-50 text-blue-600",
            icono: "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        },
        {
            label: "Total de necesidades",
            valor: totalNecesidades,
            color: "bg-amber-50 text-amber-600",
            icono: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        },
        {
            label: "Total de usuarios",
            valor: totalUsuarios,
            color: "bg-teal/10 text-teal",
            icono: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z"
        }
    ];

    return(
        <div className="min-h-screen bg-gray-100 px-6 py-10">
            <div className="max-w-6xl mx-auto flex flex-col gap-8">

                {/* Encabezado del panel */}
                <PanelHeader
                    titulo="Panel de Administración"
                    subtitulo="Vista general del sistema y accesos a la gestión."
                />

                {/* Tarjetas de metricas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {metricas.map((metrica) => (
                        <div
                            key={metrica.label}
                            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-3"
                        >
                            <div
                                 className={`w-11 h-11 rounded-xl flex items-center justify-center ${metrica.color}`}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={metrica.icono} />
                                </svg>
                            </div>
                            <span className="text-3xl font-bold text-navy">{metrica.valor}</span>
                            <span className="text-sm text-gray-500">{metrica.label}</span>
                        </div>
                    ))}
                </div>

                {/* Accesos directos a secciones de gestion administrativa */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold text-navy">Gestión</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Gestion de usuarios */}
                        <div
                            onClick={ () => navigate("/usuarios") } 
                            className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6
                            flex items-center justify-between
                            hover:border-teal hover:shadow-md transition-all duration-200 cursor-pointer"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center">
                                    <svg
                                        className="w-6 h-6 text-teal"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                            d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z"
                                        />
                                    </svg>
                                </div>

                                <div className="flex flex-col">
                                    <span className="font-semibold text-navy">Gestionar usuarios</span>
                                    <span className="text-sm text-gray-500">Crear y administrar roles del sistema</span>
                                </div>
                            </div>

                            <svg
                                 className="w-5 h-5 text-gray-300 group-hover:text-teal transition-colors"
                                 fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </div>

                        {/* Colas de mensajes */}
                        <div
                            onClick={ () => navigate("/colas") }
                            className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6
                            flex items-center justify-between
                            hover:border-teal hover:shadow-md transition-all duration-200 cursor-pointer"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <svg
                                        className="w-6 h-6 text-blue-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                            d="M4 6h16M4 12h16M4 18h10"
                                        />
                                    </svg>
                                </div>

                                <div className="flex flex-col">
                                    <span className="font-semibold text-navy">Colas de mensajes</span>
                                    <span className="text-sm text-gray-500">Monitorear colas, alertas y DLQ</span>
                                </div>
                            </div>

                            <svg
                                 className="w-5 h-5 text-gray-300 group-hover:text-teal transition-colors"
                                 fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </div>

                        {/* Espacio para agregar otros enlaces */}
                    </div>
                </div>
            </div>
        </div>
    );
};