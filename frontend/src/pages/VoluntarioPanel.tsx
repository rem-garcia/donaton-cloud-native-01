/**
 * @module pages/VoluntarioPanel
 * @author Remi García, Benjamin Llanquiman y Ricardo Díaz.
 * @description Panel de operaciones en terreno para el actor Voluntario.
 *
 * Funcionalidades disponibles:
 * - Formulario para registrar donaciones físicas recibidas en el centro de acopio.
 * - Tabla con todas las donaciones registradas en el sistema y su estado actual.
 *
 * Comunicación con el backend:
 * - GET /api/donaciones → carga la lista de donaciones al iniciar.
 * - POST /api/donaciones → registra una nueva donación desde el formulario.
 *   Al registrar exitosamente, agrega la nueva donación al inicio de la lista
 *   local sin necesidad de recargar toda la página.
 */

import { useForm, type SubmitHandler } from "react-hook-form";
import { donacionSchema, type DonacionType } from "../schemas/donacionSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import type { DonacionResponse } from "../dtos/donacionResponseDto";
import PanelHeader from "../components/PanelHeader";

/**
 * Panel del voluntario para registro y consulta de donaciones en terreno.
 * Carga la lista de donaciones al montar el componente y permite registrar
 * nuevas donaciones físicas desde el formulario superior.
 *
 * @returns Página con formulario de registro y tabla de donaciones.
 */
export default function VoluntarioPanel() {
    const [ donaciones, setDonaciones ] = useState<DonacionResponse[]>([]);
    
    const [ serverError, setServerError ] = useState<string | null>(null);

    const { register, formState: { errors }, handleSubmit, reset } = useForm<DonacionType>({
        resolver: zodResolver(donacionSchema),
        defaultValues: {
            tipo: "",
            cantidad: 0,
            peso: 0,
            nombreDonante: "",
            correoDonante: ""
        }
    });

    // Se obtienen las donaciones desde la API
    useEffect(() => {
        const cargarDonaciones = async () => {
            try {
                const response = await fetch("http://localhost:3000/api/donaciones", {
                    credentials: "include"
                });

                const texto = await response.text();

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${texto}`);
                }
                
                if (!texto.trim()) {
                    setDonaciones([]);
                    return;
                }

                const data: DonacionResponse[] = JSON.parse(texto);
                setDonaciones(data);

            } catch(error) {
                console.error(`Error al cargar las donaciones\nDetalle:\n${error}`)
            }
        }
        cargarDonaciones();
    }, []);

    // Encabezados de las columnas de la tabla de donaciones
    const donacionesHeaders = ["Tipo", "Cantidad", "Peso (kg)", "Donante", "Email", "Fecha-Reg"];

    const onSubmitDonacion: SubmitHandler<DonacionType> = async (data) => {
        try {
            const response = await fetch("http://localhost:3000/api/donaciones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(data)
            });

            const json = await response.json().catch(() => ({}));

            // Mostrar mensajes de error si status code no es 200 y se sale de la funcion
            if(!response.ok) {
                const msg = (json && (json.error || json.message)) || `Error ${response.status}`;
                setServerError(String(msg));

                return;
            }

            // Si datos fueron enviados exitosamente, se reinicia el formulario.
            if(serverError) {
                setServerError(null);
            }

            const nuevaDonacion: DonacionResponse = json;

            setDonaciones((donacionesActuales) => [nuevaDonacion, ...donacionesActuales]);

            reset();

        } catch(error: any) {
            setServerError(error?.message ?? "Error en el servidor");
        }
    };

    return(
        <div className="min-h-screen bg-gray-200 px-6 py-10">
            <div className="max-w-6xl mx-auto flex flex-col gap-8">

                {/* Encabezado del panel */}
                <PanelHeader
                    titulo="Panel del Voluntario"
                    subtitulo="Registra las donaciones recibidas en el centro de acopio."
                />

                {/* Formulario de registro de donación */}
                <form
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8"
                    onSubmit={ handleSubmit(onSubmitDonacion) }
                >
                    <h2 className="text-lg font-semibold text-navy mb-4">Registrar nueva donación</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="tipo" className="text-sm font-semibold text-navy">Tipo</label>
                            { errors.tipo?.message && <p className="text-sm text-red-500 mt-[2px]">{errors.tipo.message}</p> }
                            <input
                                id="tipo"
                                { ...register("tipo") }
                                placeholder="Por ej: Ropa"
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="cantidad" className="text-sm font-semibold text-navy">Cantidad (unidades de la donación)</label>
                            { errors.cantidad?.message && <p className="text-sm text-red-500 my-[2px]">{errors.cantidad.message}</p> }
                            <input
                                id="cantidad"
                                type="number"
                                { ...register("cantidad") }
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="peso" className="text-sm font-semibold text-navy">Peso en kilogramos</label>
                            { errors.peso?.message && <p className="text-sm text-red-500 my-[2px]">{errors.peso.message}</p> }
                            <input
                                id="peso"
                                type="number"
                                step= "0.01"
                                { ...register("peso") }
                                placeholder="Peso (en kilogramos o kg)"
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="nombre-donante" className="text-sm font-semibold text-navy">Nombre de el/la donante</label>
                            <input
                                id="nombre-donante"
                                { ...register("nombreDonante") }
                                placeholder="Opcional"
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="correo-donante" className="text-sm font-semibold text-navy">Correo de el/la donante</label>
                            { errors.correoDonante?.message && <p className="text-sm text-red-500 my-[2px]">{errors.correoDonante.message}</p> }
                            <input
                                id="correo-donante"
                                { ...register("correoDonante") }
                                placeholder="Por ej: nombre@mail.com"
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            />
                        </div>
                    </div>

                    <button
                        className="bg-teal text-navy font-semibold px-6 py-2.5 rounded-lg
                                   hover:bg-teal/90 transition-all duration-200 mt-4"
                    >
                        Registrar donación
                    </button>

                    { serverError && (<p className="mt-3 text-sm text-red-500">Error: {serverError}</p>)  }
                </form>

                {/* Tabla de donaciones registradas */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-navy">Donaciones registradas</h2>
                    </div>

                    {/* Codigo de la tabla (por agregar) */}
                    <div className="overflow-x-auto">
                        { donaciones.length !== 0 ?
                            (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-left">
                                        <tr>
                                            {donacionesHeaders.map((header, index) => (
                                                <th key={index} className="px-6 py-3 font-semibold">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                    {donaciones.map((donacion) => (
                                        <tr key={donacion.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-navy">
                                                {donacion.tipo}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {donacion.cantidad}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {donacion.peso}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {!donacion.nombreDonante ? "-" : donacion.nombreDonante}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {donacion.correoDonante}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {new Date(donacion.creadoEn).toLocaleDateString("es-CL")}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            )
                            :
                            (<p className="py-6 text-md text-center text-navy">No hay donaciones registradas</p>)
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};