// CONFIGURACIÓN DE TU SUPABASE
const supabaseUrl = 'https://jvjzqodxumblrkiisfva.supabase.co'; 
const supabaseKey = 'sb_publishable_k_MTOsgTsM-vTvGk4bARiQ_QjvEJaPX';

const client = supabase.createClient(supabaseUrl, supabaseKey);

// GIFs de Djokovic
const GIF_ACIERTO = "https://media1.tenor.com/m/Ayzh8aM2iKAAAAAd/novak-djokovic-goat.gif";
const GIF_FALLO = "https://media1.tenor.com/m/0q37Cfr4pLgAAAAd/novak-djokovic-falling.gif";

async function entrarAlJuego() {
    const nombre = document.getElementById('user-name-input').value.trim().toUpperCase();
    if (!nombre) return;
    const { data } = await client.from('clasificacion').select('*').eq('nombre', nombre).single();
    if (!data) await client.from('clasificacion').insert([{ nombre: nombre, puntos: 0 }]);
    localStorage.setItem('usuarioActivo', nombre);
    iniciarApp(nombre);
}

async function seleccionarOpcion(opcionId) {
    const nombre = localStorage.getItem('usuarioActivo');
    if (nombre === "ADMIN") return;
    const { data: opt } = await client.from('opciones').select('puntos_valor, es_correcta').eq('id', opcionId).single();
    if (opt.es_correcta !== null) return;

    const { data: mResp } = await client.from('respuestas').select('opcion_id').eq('nombre_usuario', nombre);
    if (mResp && mResp.length > 0) {
        const ids = mResp.map(r => r.opcion_id);
        const { data: cats } = await client.from('opciones').select('puntos_valor').in('id', ids);
        if (cats.some(c => c.puntos_valor === opt.puntos_valor)) return alert("Ya votaste en esta categoría.");
    }
    await client.from('respuestas').insert([{ nombre_usuario: nombre, opcion_id: opcionId }]);
    actualizarTodo();
}

async function procesarOpcion(opcionId, esCorrecta, puntosValor) {
    const confirmacion = confirm(esCorrecta ? "¿Confirmas que es CORRECTA?" : "¿Confirmas que es INCORRECTA?");
    if (!confirmacion) return;

    await client.from('opciones').update({ es_correcta: esCorrecta }).eq('id', opcionId);

    if (esCorrecta) {
        const { data: acertantes } = await client.from('respuestas').select('nombre_usuario').eq('opcion_id', opcionId).eq('procesada', false);
        if (acertantes && acertantes.length > 0) {
            for (let user of acertantes) {
                let { data: p } = await client.from('clasificacion').select('puntos').eq('nombre', user.nombre_usuario).single();
                await client.from('clasificacion').update({ puntos: (p.puntos || 0) + puntosValor }).eq('nombre', user.nombre_usuario);
                await client.from('respuestas').update({ procesada: true }).eq('nombre_usuario', user.nombre_usuario).eq('opcion_id', opcionId);
            }
            mostrarFeedback(true);
        } else {
            mostrarFeedback(false);
        }
    } else {
        await client.from('respuestas').update({ procesada: true }).eq('opcion_id', opcionId);
        mostrarFeedback(false);
    }
    actualizarTodo();
}

function mostrarFeedback(exito) {
    const modal = document.getElementById('modal-feedback');
    const gif = document.getElementById('feedback-gif');
    const titulo = document.getElementById('feedback-titulo');

    titulo.innerText = exito ? "¡DJOKOVIC GOAT - PUNTOS SUMADOS!" : "NADIE SUMA PUNTOS";
    titulo.style.color = exito ? "var(--green)" : "var(--red)";
    gif.src = exito ? GIF_ACIERTO : GIF_FALLO;
    
    modal.style.display = "block";
}

function cerrarModal() { document.getElementById('modal-feedback').style.display = "none"; }

async function cargarOpciones() {
    const { data: opciones } = await client.from('opciones').select('*').order('id', { ascending: false });
    const user = localStorage.getItem('usuarioActivo');
    const esAdmin = user === "ADMIN";
    const { data: mResp } = await client.from('respuestas').select('opcion_id').eq('nombre_usuario', user);
    const respIds = mResp ? mResp.map(r => r.opcion_id) : [];

    const container = document.getElementById('contenedor-opciones-activas');
    container.innerHTML = "";
    (opciones || []).forEach(opt => {
        const yaVoto = respIds.includes(opt.id);
        const div = document.createElement('div');
        div.className = `btn-option ${yaVoto ? 'elegida' : ''}`;
        
        let label = "";
        if (opt.es_correcta === true) label = " <span style='color:var(--green)'>[CORRECTA ✅]</span>";
        if (opt.es_correcta === false) label = " <span style='color:var(--red)'>[INCORRECTA ❌]</span>";

        div.innerHTML = `<div onclick="${opt.es_correcta === null ? `seleccionarOpcion(${opt.id})` : ''}">
            <b>${opt.texto_opcion}</b> (${opt.puntos_valor} pts)${label}
        </div>`;

        if (esAdmin && opt.es_correcta === null) {
            const actions = document.createElement('div');
            actions.className = "admin-actions";
            actions.innerHTML = `
                <button class="btn-correct" onclick="procesarOpcion(${opt.id}, true, ${opt.puntos_valor})">SI</button>
                <button class="btn-incorrect" onclick="procesarOpcion(${opt.id}, false, ${opt.puntos_valor})">NO</button>
            `;
            div.appendChild(actions);
        }
        container.appendChild(div);
    });
}

async function actualizarRanking() {
    const { data: lista } = await client.from('clasificacion').select('*').order('puntos', { ascending: false });
    document.getElementById('tabla-ranking').innerHTML = (lista || []).map((j, i) => `
        <div class="ranking-item"><span>${i+1}. ${j.nombre}</span><span><b>${j.puntos}</b> pts</span></div>
    `).join('');
}

async function crearOpcion() {
    const t = document.getElementById('nueva-opcion-texto').value;
    const p = parseInt(document.getElementById('nueva-opcion-puntos').value);
    if(!t) return;
    await client.from('opciones').insert([{ texto_opcion: t, puntos_valor: p, es_correcta: null }]);
    document.getElementById('nueva-opcion-texto').value = "";
    actualizarTodo();
}

function actualizarTodo() { actualizarRanking(); cargarOpciones(); }
function iniciarApp(n) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-game').style.display = 'block';
    document.getElementById('current-user-display').innerText = n;
    if (n === "ADMIN") document.getElementById('panel-admin').style.display = 'block';
    actualizarTodo();
}
window.onload = () => { const u = localStorage.getItem('usuarioActivo'); if(u) iniciarApp(u); };
function cerrarSesion() { localStorage.removeItem('usuarioActivo'); location.reload(); }

