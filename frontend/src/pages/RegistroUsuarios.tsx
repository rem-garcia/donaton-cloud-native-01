/**
 * @module pages/RegistroUsuarios
 * @author Remi Garcia, Benjamin Llanquiman y Ricardo Díaz
 * @description Página de gestión de usuarios internos del sistema Donaton.
 *
 * Esta página es accesible exclusivamente por los usuarios de rol ADMIN.
 *
 * Funcionalidades disponibles:
 * - Formulario para crear nuevos usuarios internos.
 * - Tabla con todos los usuarios registrados en el sistema y sus roles.
 *
 * Los roles disponibles son: ADMIN, COORDINADOR y VOLUNTARIO.
 * Cada rol determina a qué paneles puede acceder el usuario creado.
 *
 */

import { useEffect, useState } from "react";
import { type UsuarioResponse } from "../dtos/usuarioResponseDto";
import { useForm, type SubmitHandler } from "react-hook-form";
import { usuarioSchema, type RegistroUsuarioType } from "../schemas/usuarioSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { Rol } from "../types/rolEnum";

/**
 * Página de gestión de usuarios internos del sistema.
 * Permite al usuario ADMIN crear nuevos usuarios y visualizar los existentes.
 *
 * @returns Página con formulario de creación y tabla de usuarios registrados.
 */
export default function RegistroUsuarios() {
    const [ usuarios, setUsuarios ] = useState<UsuarioResponse[]>([]);
    
    const [ serverError, setServerError ] = useState<string | null>(null);

    const { register, formState: { errors }, handleSubmit, reset } = useForm<RegistroUsuarioType>({
        resolver: zodResolver(usuarioSchema),
        defaultValues: {
            nombre: "",
            password: "",
            correo: "",
            rol: undefined,
            nombreOrg: ""
        }

    });

    const navigate = useNavigate();

    // Se cargan los usuarios solo al montar la vista
    useEffect(() => {
        const cargarUsuarios = async () => {
            try {
                const response = await fetch("http://localhost:3000/api/usuarios", {
                    credentials: "include"
                });

                const texto = await response.text();

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${texto}`);
                }
                
                if (!texto.trim()) {
                    setUsuarios([]);
                    return;
                }

                const data: UsuarioResponse[] = JSON.parse(texto);
                setUsuarios(data);

            } catch(error) {
                console.error(`Error al cargar las necesidades\nDetalle:\n${error}`)
            }
        }

        cargarUsuarios()},[]
    );

    const onSubmitUsuario: SubmitHandler<RegistroUsuarioType> = async (data) => {
        try {
            const response = await fetch("http://localhost:3000/api/usuarios", {
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

            if(serverError) {
                setServerError(null);
            }

            // Si datos fueron enviados exitosamente, y se actualizan los datos
            // del estado de 'usuarios' (es importante verificar la bbdd o usar
            // otra herramienta, como web sockets, que permitan aquello) y se
            // reinicia el formulario.
            const nuevoUsuario: UsuarioResponse = json;

            setUsuarios((usuariosActuales) => [nuevoUsuario, ...usuariosActuales]);

            reset();

        } catch(error: any) {
            setServerError(error?.message ?? "Error en el servidor");
        }
    };

    const roles = [
        {id: 1, valor: Rol.VOLUNTARIO, texto: "Voluntario"},
        {id: 2, valor: Rol.COLABORADOR, texto: "Colaborador"},
        {id: 3, valor: Rol.ADMIN, texto: "Administrador"}
    ];

    const headerUsuarios = ["ID", "Nombre", "Correo", "Rol", "Nombre Org"];

    return(
        <div className="min-h-screen bg-gray-100 px-6 md:px-60 py-10">
            <div className="max-w-6xl mx-auto flex flex-col gap-8">

                {/* Enlace para volver al dashboard de administracion */}
                <div
                    className="text-gray-400 text-sm hover:text-navy transition-colors w-fit cursor-pointer"
                    onClick={() => navigate("/admin-dashboard")}
                >
                    <p>← Volver al dashboard</p>
                </div>

                {/* Encabezado de la pagina */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold text-navy">Gestión de usuarios</h1>
                    <p className="text-gray-500 text-sm">
                        Crea y administra los usuarios del sistema y sus roles.
                    </p>
                </div>

                {/* Formulario de creacion de usuario */}
                <form
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:px-15 md:py-8"
                    onSubmit={ handleSubmit(onSubmitUsuario) }
                >
                    <h2 className="text-lg font-semibold text-navy mb-4">Crear nuevo usuario</h2>

                    <div className="grid grid-cols-1">

                        <div className="flex flex-col gap-2 mb-5">
                            <label htmlFor="nombre-usuario" className="text-sm font-semibold text-navy">Nombre completo</label>
                            { errors.nombre?.message && <p className="text-sm text-red-500 mb-[2px]">{errors.nombre.message}</p> }
                            <input
                                id="nombre-usuario"
                                { ...register("nombre") }
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            />

                        </div>

                        <div className="flex flex-col gap-2 mb-5">
                            <label htmlFor="contrasena" className="text-sm font-semibold text-navy">Contraseña</label>

                            { errors.password?.message && <p className="text-sm text-red-500 mb-[2px]">{errors.password.message}</p> }
                            <input
                                id="contrasena"
                                type="password"
                                { ...register("password") }
                                placeholder="Requisito mínimo: Un caracter especial, una letra mayuscula, una minuscula y un digito"
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            />
                        </div>

                        <div className="flex flex-col gap-2 mb-5">
                            <label htmlFor="email" className="text-sm font-semibold text-navy">Correo electrónico</label>

                            { errors.correo?.message && <p className="text-sm text-red-500 mb-[2px]">{errors.correo.message}</p> }
                            <input
                                id="email"
                                type="email"
                                { ...register("correo") }
                                placeholder="Ej: nombre@mail.com"
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            />
                        </div>

                        <div className="flex flex-col gap-2 mb-5">
                            <label htmlFor="roles" className="text-sm font-semibold text-navy">Roles</label>

                            { errors.rol?.message && <p className="text-sm text-red-500 mb-[2px]">{errors.rol.message}</p> }
                            <select
                                id="roles"
                                { ...register("rol") }
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white
                                            focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            >
                                <option value="" disabled>Seleccione un rol para el usuario...</option>

                                {roles.map((rol) => (
                                    <option key={rol.id} value={rol.valor}>{rol.texto}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-2 mb-5">
                            <label htmlFor="nombre-org" className="text-sm font-semibold text-navy">Nombre de la organización</label>

                            <input
                                id="nombre-org"
                                { ...register("nombreOrg") }
                                placeholder="Opcional: A qué organización pertenece"
                                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                                           focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                            />
                        </div>
                    </div>

                    <button
                        className="bg-teal text-navy font-semibold px-6 py-2.5 rounded-lg hover:bg-teal/90 transition-all duration-200 mt-4"
                    >
                        Crear usuario
                    </button>
                </form>
                
                {/* Tabla de usuarios registrados */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                    {/* Titulo */}
                    <div className="p-6 border-b border-gray-100 text-lg font-semibold text-navy">
                        <h2>Usuarios registrados</h2>
                    </div>

                    {/* Tabla */}
                    <div className="overflow-x-auto">
                        { usuarios.length !== 0 ? (
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-left font-semibold">
                                    <tr>
                                        {headerUsuarios.map((header, index) => (
                                            <th
                                                key={index}
                                                 className="px-6 py-3"
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {usuarios.map((usuario) => (
                                        <tr key={usuario.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-gray-700">{usuario.id}</td>
                                            <td className="px-6 py-4 font-medium text-navy">{usuario.nombre}</td>
                                            <td className="px-6 py-4 text-gray-700">{usuario.correo}</td>
                                            <td className="px-6 py-4 text-gray-700">{usuario.rol}</td>
                                            <td className="px-6 py-4 text-gray-700">{!usuario.nombreOrg ? "-" : usuario.nombreOrg}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                        :
                            (<p className="py-6 text-md text-center text-navy">No hay usuarios registrados</p>)
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};