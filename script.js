// CONFIGURACIÓN DE TU SUPABASE
const supabaseUrl = 'https://jvjzqodxumblrkiisfva.supabase.co'; 
const supabaseKey = 'sb_publishable_k_MTOsgTsM-vTvGk4bARiQ_QjvEJaPX';

const client = supabase.createClient(supabaseUrl, supabaseKey);

const GIF_ACIERTO = "https://media.tenor.com/7p_m_qO9_v8AAAAC/eth-1ethfp.gif";
const GIF_FALLO = "https://media1.tenor.com/m/0q37Cfr4pLgAAAAd/novak-djokovic-falling.gif";

// --- ACCESO ---
async function entrarAlJuego() {
    const nombre = document.getElementById('user-name-input').value.trim().toUpperCase();
    if (!nombre) return alert("Escribe tu nombre");

    const { data: usuario } = await client.from('clasificacion').select('*').eq('nombre', nombre).single();
    if (!usuario) {
        await client.from('clasificacion').insert([{ nombre: nombre, puntos: 0 }]);
    }

    localStorage.setItem('usuarioActivo', nombre);
    iniciarApp(nombre);
}

// --- LÓGICA USUARIO ---
async function seleccionarOpcion(opcionId) {
    const nombre = localStorage.getItem('usuarioActivo');
    if (nombre === "ADMIN") return;

    const { data: opt } = await client.from('opciones').select('puntos_valor').eq('id', opcionId).single();
    const { data: mResp } = await client.from('respuestas').select('opcion_id').eq('nombre_usuario', nombre);

    if (mResp && mResp.length > 0) {
        const ids = mResp.map(r => r.opcion_id);
        const { data: cats } = await client.from('opciones').select('puntos_valor').in('id', ids);
        if (cats.some(c => c.puntos_valor === opt.puntos_valor)) {
            return alert(`Ya votaste en la categoría de ${opt.puntos_valor} puntos.`);
        }
    }

    await client.from('respuestas').insert([{ nombre_usuario: nombre, opcion_id: opcionId }]);
    actualizarTodo();
}

// --- LÓGICA ADMIN ---
async function validarComoCorrecta(opcionId, puntosValor) {
    if(!confirm("¿Validar puntos?")) return;
    await client.from('opciones').update({ es_correcta: true }).eq('id', opcionId);

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
    actualizarTodo();
}

async function modificarPuntosManual(nombre, puntosActuales) {
    const nuevo = prompt(`Nuevo puntaje para ${nombre}:`, puntosActuales);
    if (nuevo !== null && !isNaN(nuevo)) {
        await client.from('clasificacion').update({ puntos: parseInt(nuevo) }).eq('nombre', nombre);
        actualizarTodo();
    }
}

async function crearOpcion() {
    const texto = document.getElementById('nueva-opcion-texto').value;
    const pts = parseInt(document.getElementById('nueva-opcion-puntos').value);
    if(!texto) return;
    await client.from('opciones').insert([{ texto_opcion: texto, puntos_valor: pts }]);
    document.getElementById('nueva-opcion-texto').value = "";
    actualizarTodo();
}

// --- UI ---
function mostrarFeedback(exito) {
    document.getElementById('feedback-titulo').innerText = exito ? "¡ACIERTOS!" : "NADIE ACERTÓ";
    document.getElementById('feedback-titulo').style.color = exito ? "var(--green)" : "var(--red)";
    document.getElementById('feedback-gif').src = exito ? GIF_ACIERTO : GIF_FALLO;
    document.getElementById('modal-feedback').style.display = "block";
}
function cerrarModal() { document.getElementById('modal-feedback').style.display = "none"; }

async function actualizarRanking() {
    const { data: lista } = await client.from('clasificacion').select('*').order('puntos', { ascending: false });
    const esAdmin = localStorage.getItem('usuarioActivo') === "ADMIN";
    document.getElementById('tabla-ranking').innerHTML = (lista || []).map((j, i) => `
        <div class="ranking-item" onclick="${esAdmin ? `modificarPuntosManual('${j.nombre}', ${j.puntos})` : ''}">
            <span>${i+1}. ${j.nombre} ${esAdmin ? '✏️' : ''}</span>
            <span><b>${j.puntos}</b> pts</span>
        </div>
    `).join('');
}

async function cargarOpciones() {
    const { data: opciones } = await client.from('opciones').select('*').order('puntos_valor', { ascending: true });
    const user = localStorage.getItem('usuarioActivo');
    const esAdmin = user === "ADMIN";

    const { data: mResp } = await client.from('respuestas').select('opcion_id').eq('nombre_usuario', user);
    const respIds = mResp ? mResp.map(r => r.opcion_id) : [];
    const { data: infoC } = await client.from('opciones').select('puntos_valor').in('id', respIds);
    const cGastadas = infoC ? infoC.map(c => c.puntos_valor) : [];

    const container = document.getElementById('contenedor-opciones-activas');
    container.innerHTML = "";
    (opciones || []).forEach(opt => {
        const yaVoto = respIds.includes(opt.id);
        const bloqueada = cGastadas.includes(opt.puntos_valor) && !yaVoto;
        const div = document.createElement('div');
        div.className = `btn-option ${yaVoto ? 'elegida' : ''} ${bloqueada ? 'bloqueada' : ''}`;
        div.innerHTML = `<div onclick="${!bloqueada && !yaVoto ? `seleccionarOpcion(${opt.id})` : ''}">
            <b>${opt.texto_opcion}</b> (Cat: ${opt.puntos_valor} pts)
            ${opt.es_correcta ? ' ✅' : ''} ${yaVoto ? ' ⭐' : ''}
        </div>`;
        if (esAdmin) {
            const btnBox = document.createElement('div');
            if(!opt.es_correcta) {
                const bVal = document.createElement('button'); bVal.innerText = "VALIDAR"; bVal.className="btn-main";
                bVal.onclick = () => validarComoCorrecta(opt.id, opt.puntos_valor); btnBox.appendChild(bVal);
            }
            const bDel = document.createElement('button'); bDel.innerText = "Borrar"; bDel.className="btn-delete-opt";
            bDel.onclick = () => { client.from('opciones').delete().eq('id', opt.id).then(actualizarTodo); };
            btnBox.appendChild(bDel); div.appendChild(btnBox);
        }
        container.appendChild(div);
    });
}

function actualizarTodo() { actualizarRanking(); cargarOpciones(); }
function iniciarApp(nombre) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-game').style.display = 'block';
    document.getElementById('current-user-display').innerText = nombre;
    if (nombre === "ADMIN") document.getElementById('panel-admin').style.display = 'block';
    actualizarTodo();
}

window.onload = () => { const u = localStorage.getItem('usuarioActivo'); if(u) iniciarApp(u); };
function cerrarSesion() { localStorage.removeItem('usuarioActivo'); location.reload(); }
setInterval(() => { if(localStorage.getItem('usuarioActivo')) actualizarTodo(); }, 15000);
