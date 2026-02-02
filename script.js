// CONFIGURACIÓN DE TU SUPABASE
const supabaseUrl = 'https://jvjzqodxumblrkiisfva.supabase.co'; 
const supabaseKey = 'sb_publishable_k_MTOsgTsM-vTvGk4bARiQ_QjvEJaPX';
const client = supabase.createClient(supabaseUrl, supabaseKey);

const GIF_ACIERTO = "https://media1.tenor.com/m/Ayzh8aM2iKAAAAAd/novak-djokovic-goat.gif";
const GIF_FALLO = "https://media1.tenor.com/m/0q37Cfr4pLgAAAAd/novak-djokovic-falling.gif";

// LOGIN
async function entrarAlJuego() {
    const nombre = document.getElementById('user-name-input').value.trim().toUpperCase();
    if (!nombre) return alert("Escribe tu nombre");
    
    const { data } = await client.from('clasificacion').select('*').eq('nombre', nombre).single();
    if (!data) await client.from('clasificacion').insert([{ nombre: nombre, puntos: 0 }]);
    
    localStorage.setItem('usuarioActivo', nombre);
    iniciarApp(nombre);
}

// ADMIN: CREAR
async function crearOpcion() {
    const t = document.getElementById('nueva-opcion-texto').value;
    const c = parseInt(document.getElementById('nueva-opcion-puntos').value);
    if(!t) return;
    
    await client.from('opciones').insert([{ texto_opcion: t, categoria: c }]);
    document.getElementById('nueva-opcion-texto').value = "";
    actualizarTodo();
}

// ADMIN: RESET JORNADA
async function resetearTablero() {
    if(!confirm("¿Borrar apuestas? El ranking se mantendrá.")) return;
    await client.rpc('limpiar_jornada');
    actualizarTodo();
}

// USUARIO: SELECCIONAR (1 por categoría)
async function seleccionarOpcion(id, cat) {
    const nombre = localStorage.getItem('usuarioActivo');
    if (nombre === "ADMIN") return;

    // Verificar si ya tiene esa categoría elegida
    const { data: votos } = await client.from('respuestas')
        .select('opciones(categoria)')
        .eq('nombre_usuario', nombre);
    
    const yaVotoCat = votos?.some(v => v.opciones.categoria === cat);
    if (yaVotoCat) return alert("Ya has elegido una opción de " + cat + " puntos.");

    await client.from('respuestas').insert([{ 
        nombre_usuario: nombre, 
        opcion_id: id, 
        puntos_en_juego: cat 
    }]);
    actualizarTodo();
}

// ADMIN: VALIDAR RESULTADOS
async function procesarOpcion(id, exito, puntos) {
    await client.from('opciones').update({ es_correcta: exito }).eq('id', id);

    if (exito) {
        const { data: acertantes } = await client.from('respuestas')
            .select('nombre_usuario')
            .eq('opcion_id', id)
            .eq('procesada', false);

        if (acertantes) {
            for (let u of acertantes) {
                const { data: user } = await client.from('clasificacion').select('puntos').eq('nombre', u.nombre_usuario).single();
                await client.from('clasificacion').update({ puntos: (user.puntos || 0) + puntos }).eq('nombre', u.nombre_usuario);
                await client.from('respuestas').update({ procesada: true }).eq('nombre_usuario', u.nombre_usuario).eq('opcion_id', id);
            }
            mostrarFeedback(true);
        }
    } else {
        await client.from('respuestas').update({ procesada: true }).eq('opcion_id', id);
        mostrarFeedback(false);
    }
    actualizarTodo();
}

// VISUALIZACIÓN
async function cargarOpciones() {
    const { data: opts } = await client.from('opciones').select('*').order('id', {ascending: false});
    const user = localStorage.getItem('usuarioActivo');
    const { data: misVotos } = await client.from('respuestas').select('opcion_id').eq('nombre_usuario', user);
    const idsVotados = misVotos?.map(v => v.opcion_id) || [];

    const container = document.getElementById('contenedor-opciones-activas');
    container.innerHTML = "";

    opts?.forEach(o => {
        const div = document.createElement('div');
        div.className = `btn-option ${idsVotados.includes(o.id) ? 'elegida' : ''}`;
        let res = o.es_correcta === true ? " ✅" : o.es_correcta === false ? " ❌" : "";
        
        div.innerHTML = `
            <div onclick="${o.es_correcta === null ? `seleccionarOpcion(${o.id}, ${o.categoria})` : ''}">
                ${o.texto_opcion} [${o.categoria} pts] ${res}
            </div>
        `;

        if (user === "ADMIN" && o.es_correcta === null) {
            div.innerHTML += `
                <div class="admin-actions">
                    <button onclick="procesarOpcion(${o.id}, true, ${o.categoria})">SÍ</button>
                    <button onclick="procesarOpcion(${o.id}, false, ${o.categoria})">NO</button>
                </div>`;
        }
        container.appendChild(div);
    });
}

async function actualizarRanking() {
    const { data: lista } = await client.from('clasificacion').select('*').order('puntos', { ascending: false });
    document.getElementById('tabla-ranking').innerHTML = lista?.map((j, i) => `
        <div class="ranking-item"><span>${i+1}. ${j.nombre}</span><span><b>${j.puntos}</b> pts</span></div>
    `).join('') || "";
}

function actualizarTodo() { actualizarRanking(); cargarOpciones(); }

function iniciarApp(n) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-game').style.display = 'block';
    document.getElementById('current-user-display').innerText = n;
    if (n === "ADMIN") document.getElementById('panel-admin').style.display = 'block';
    actualizarTodo();
}

function mostrarFeedback(e) {
    const m = document.getElementById('modal-feedback');
    document.getElementById('feedback-titulo').innerText = e ? "¡ACIERTO! Puntos sumados." : "FALLO...";
    document.getElementById('feedback-gif').src = e ? GIF_ACIERTO : GIF_FALLO;
    m.style.display = "flex";
}

function cerrarModal() { document.getElementById('modal-feedback').style.display = "none"; }
function cerrarSesion() { localStorage.removeItem('usuarioActivo'); location.reload(); }
window.onload = () => { if(localStorage.getItem('usuarioActivo')) iniciarApp(localStorage.getItem('usuarioActivo')); };
setInterval(actualizarTodo, 20000);
