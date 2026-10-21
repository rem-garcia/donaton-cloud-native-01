import { useForm, type SubmitHandler } from "react-hook-form";
import { necesidadSchema, type NecesidadType } from "../schemas/necesidadSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import type { NecesidadResponse } from "../dtos/necesidadResponseDto";
import PanelHeader from "../components/PanelHeader";

export default function ColaboradorPanel () {
    const [ necesidades, setNecesidades ] = useState<NecesidadResponse[]>([]);
    
    const [ serverError, setServerError ] = useState<string | null>(null);

    const { register, formState: { errors }, handleSubmit, reset } = useForm<NecesidadType>({
        resolver: zodResolver(necesidadSchema),
        defaultValues: {
            tipoNecesidad: "",
            descripcion: "",
            prioridad: "",
            comunidadAfectada: ""
        }
    });

    useEffect(() => {
        const cargarNecesidades = async () => {
            try {
                const response = await fetch("http://localhost:3000/api/necesidades", {
                    credentials: "include"
                });

                const texto = await response.text();

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${texto}`);
                }
                
                if (!texto.trim()) {
                    setNecesidades([]);
                    return;
                }

                const data: NecesidadResponse[] = JSON.parse(texto);
                setNecesidades(data);

            } catch(error) {
                console.error(`Error al cargar las necesidades\nDetalle:\n${error}`)
            }
        }

        cargarNecesidades()},[]
    );

    const onSubmitNecesidad: SubmitHandler<NecesidadType> = async (data) => {
        try {
            const response = await fetch("http://localhost:3000/api/necesidades", {
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

            const nuevaNecesidad: NecesidadResponse = json;

            setNecesidades((necesidadesActuales) => [nuevaNecesidad, ...necesidadesActuales]);

            reset();

        } catch(error: any) {
            setServerError(error?.message ?? "Error en el servidor");
        }
    };

    // Encabezados de las columnas de la tabla de donaciones
    const necesidadesHeaders = ["Tipo", "Descripción", "Prioridad", "Comunidad", "Fecha-Reg"];

    const tiposNecesidad = [
        {id: 1, tipoValue: "alimentos", tipoTexto: "Alimentos"},
        {id: 2, tipoValue: "ropa", tipoTexto: "Ropa"},
        {id: 3, tipoValue: "materiales_construccion", tipoTexto: "Materiales de construcción"},
        {id: 4, tipoValue: "otra", tipoTexto: "Otra"}
    ];

    const nivelesPrioridad = [
        {id: 1, idPrioridad: "priori-alta", prioridadValue: "alta" , prioridadText: "Alta" },
        {id: 2, idPrioridad: "priori-media", prioridadValue: "media", prioridadText: "Media"},
        {id: 3, idPrioridad: "priori-baja", prioridadValue: "baja", prioridadText: "Baja"}
    ];

    return(
        <div className="min-h-screen bg-gray-100 px-6 md:px-60 py-10">
            <div className="max-w-6xl mx-auto flex flex-col gap-8">

                {/* Encabezado del panel */}
                <PanelHeader
                    titulo="Panel de Colaboradores"
                    subtitulo="Registra las necesidades que, en tiempo real, tienen las comunidades afectadas."
                />

                {/* Formulario de registro de necesidades */}
                <form
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:px-15 md:py-8"
                    onSubmit={ handleSubmit(onSubmitNecesidad) }
                >

                    <h2 className="text-lg font-semibold text-navy mb-4">Registrar nueva necesidad</h2>


                    <div className="grid grid-cols-1">
                        <div className="flex flex-col gap-2 mb-5">
                            <label htmlFor="tipo-necesidad" className="text-sm font-semibold text-navy">Tipo de necesidad</label>
                            <select
                                id="tipo-necesidad"
                                { ...register("tipoNecesidad") }
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            >
                                <option value="" disabled>Seleccione el tipo de necesidad...</option>

                                {tiposNecesidad.map((tipo) => (
                                    <option key={tipo.id} value={tipo.tipoValue}>{tipo.tipoTexto}</option>
                                ))}
                            </select>

                            { errors.tipoNecesidad?.message && <p className="text-sm text-red-500 mt-[2px]">{errors.tipoNecesidad.message}</p> }
                        </div>

                        <div className="flex flex-col gap-2 mb-5">
                            <label htmlFor="descripcion" className="text-sm font-semibold text-navy">Descripción</label>
                            <input
                                id="descripcion"
                                { ...register("descripcion") }
                                placeholder="Describa la necesidad identificada"
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            />

                            { errors.descripcion?.message && <p className="text-sm text-red-500 mt-[2px]">{errors.descripcion.message}</p> }
                        </div>

                        <div className="flex flex-col gap-2 mb-5">
                            <legend className="text-sm font-semibold text-navy">Nivel de prioridad</legend>

                            {nivelesPrioridad.map((prioridad) => (
                                <div key={prioridad.id} className="text-sm">
                                    <input
                                        id={prioridad.idPrioridad}
                                        { ...register("prioridad") }
                                        type="radio"
                                        value={prioridad.prioridadValue}
                                    />
                                    <label htmlFor={prioridad.idPrioridad}>{prioridad.prioridadText}</label>
                                </div>
                            ))}

                            { errors.prioridad?.message && <p className="text-sm text-red-500 mt-[2px]">{errors.prioridad.message}</p> }
                        </div>

                        <div className="flex flex-col gap-2 mb-5">
                            <label htmlFor="comunidad-afectada" className="text-sm font-semibold text-navy">Comunidad afectada</label>
                            <input
                                id="comunidad-afectada"
                                { ...register("comunidadAfectada") }
                                placeholder="Nombre de la comunidad afectada"
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            />

                            { errors.comunidadAfectada?.message && <p className="text-sm text-red-500 mt-[2px]">{errors.comunidadAfectada.message}</p> }
                        </div>
                    </div>

                    <button
                        className="bg-teal text-navy font-semibold px-6 py-2.5 rounded-lg
                                   hover:bg-teal/90 transition-all duration-200 mt-4"
                    >
                        Registrar necesidad
                    </button>

                    { serverError && (<p className="mt-3 text-sm text-red-500">Error: {serverError}</p>) }
                </form>

{/* Tabla de donaciones registradas */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-navy">Necesidades registradas</h2>
                    </div>

                    {/* Codigo de la tabla (por agregar) */}
                    <div className="overflow-x-auto">
                        { necesidades.length !== 0 ?
                            (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-left">
                                        <tr>
                                            {necesidadesHeaders.map((header, index) => (
                                                <th key={index} className="px-6 py-3 font-semibold">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                    {necesidades.map((necesidad) => (
                                        <tr key={necesidad.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-navy">
                                                {necesidad.tipoNecesidad}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {necesidad.descripcion}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {necesidad.prioridad}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {necesidad.comunidadAfectada}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {new Date(necesidad.creadoEn).toLocaleDateString("es-CL")}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            )
                            :
                            (<p className="py-6 text-md text-center text-navy">No hay necesidades registradas</p>)
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};