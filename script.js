// CONFIGURACIÓN DE TU SUPABASE
const supabaseUrl = 'https://jvjzqodxumblrkiisfva.supabase.co'; 
const supabaseKey = 'sb_publishable_k_MTOsgTsM-vTvGk4bARiQ_QjvEJaPX';

// CAMBIO IMPORTANTE: Renombramos la variable para evitar el conflicto de nombres
const client = supabase.createClient(supabaseUrl, supabaseKey);

// --- FLUJO DE ACCESO ---
async function entrarAlJuego() {
    const nombre = document.getElementById('user-name-input').value.trim().toUpperCase();
    if (!nombre) return alert("Escribe tu nombre");

    try {
        const { data, error } = await client.from('clasificacion').select('*').eq('nombre', nombre).single();
        
        if (!data) {
            // Si el usuario no existe, lo creamos
            await client.from('clasificacion').insert([{ nombre: nombre, puntos: 0 }]);
        }

        localStorage.setItem('usuarioActivo', nombre);
        iniciarApp(nombre);
    } catch (err) {
        console.error("Error al entrar:", err);
        alert("Error de conexión. Revisa la consola (F12).");
    }
}

// --- LÓGICA DE ADMINISTRADOR ---
async function crearOpcion() {
    const texto = document.getElementById('nueva-opcion-texto').value;
    const pts = parseInt(document.getElementById('nueva-opcion-puntos').value);
    if(!texto) return;

    const { error } = await client.from('opciones').insert([{ texto_opcion: texto, puntos_valor: pts }]);
    if(error) return console.error(error);

    document.getElementById('nueva-opcion-texto').value = "";
    actualizarTodo();
}

async function borrarOpcion(id) {
    if(confirm("¿Eliminar esta opción?")) {
        await client.from('opciones').delete().eq('id', id);
        actualizarTodo();
    }
}

// --- LÓGICA DE JUEGO ---
async function cargarOpciones() {
    const { data: opciones, error } = await client.from('opciones').select('*');
    if(error) return console.error("Error cargando opciones:", error);

    const container = document.getElementById('contenedor-opciones-activas');
    const esAdmin = localStorage.getItem('usuarioActivo') === "ADMIN";
    container.innerHTML = "";

    opciones.forEach(opt => {
        const div = document.createElement('div');
        div.className = "btn-option";
        div.innerHTML = `<div onclick="sumarPuntos(${opt.puntos_valor})"><b>${opt.texto_opcion}</b><br>+${opt.puntos_valor} pts</div>`;
        
        if(esAdmin) {
            const btnDel = document.createElement('button');
            btnDel.innerText = "Eliminar";
            btnDel.className = "btn-delete-opt";
            btnDel.onclick = (e) => {
                e.stopPropagation(); // Evita que al borrar también se sumen los puntos
                borrarOpcion(opt.id);
            };
            div.appendChild(btnDel);
        }
        container.appendChild(div);
    });
}

async function sumarPuntos(cantidad) {
    const nombre = localStorage.getItem('usuarioActivo');
    
    // Obtenemos puntos actuales
    let { data: user, error } = await client.from('clasificacion').select('puntos').eq('nombre', nombre).single();
    
    if(user) {
        const nuevosPuntos = (user.puntos || 0) + cantidad;
        await client.from('clasificacion').update({ puntos: nuevosPuntos }).eq('nombre', nombre);
        actualizarTodo();
        alert(`¡+${cantidad} puntos sumados!`);
    }
}

async function actualizarRanking() {
    const { data: lista, error } = await client.from('clasificacion').select('*').order('puntos', { ascending: false });
    if(error) return;

    const tabla = document.getElementById('tabla-ranking');
    tabla.innerHTML = lista.map((j, i) => `
        <div class="ranking-item">
            <span>${i+1}. ${j.nombre}</span>
            <span><b>${j.puntos}</b> pts</span>
        </div>
    `).join('');
}

function actualizarTodo() {
    actualizarRanking();
    cargarOpciones();
}

function iniciarApp(nombre) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-game').style.display = 'block';
    document.getElementById('current-user-display').innerText = nombre;

    if (nombre === "ADMIN") {
        document.getElementById('panel-admin').style.display = 'block';
    }

    actualizarTodo();
}

// Sincronización automática cada 10 segundos
setInterval(() => {
    if(localStorage.getItem('usuarioActivo')) actualizarTodo();
}, 10000);

window.onload = () => {
    const user = localStorage.getItem('usuarioActivo');
    if (user) iniciarApp(user);
};

function cerrarSesion() {
    localStorage.removeItem('usuarioActivo');
    location.reload();
}