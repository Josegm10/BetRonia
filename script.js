// CONFIGURACIÓN DE TU SUPABASE
const supabaseUrl = 'https://jvjzqodxumblrkiisfva.supabase.co'; 
const supabaseKey = 'sb_publishable_k_MTOsgTsM-vTvGk4bARiQ_QjvEJaPX';
const client = supabase.createClient(supabaseUrl, supabaseKey);

// --- 1. LOGIN ---
async function entrar() {
    const user = document.getElementById('username').value.trim().toUpperCase();
    if (!user) return alert("Pon un nombre");

    // Crear usuario si no existe
    const { data } = await client.from('clasificacion').select('*').eq('nombre', user).single();
    if (!data) {
        await client.from('clasificacion').insert([{ nombre: user, puntos: 0 }]);
    }

    localStorage.setItem('usuario', user);
    mostrarJuego(user);
}

function mostrarJuego(user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('display-user').innerText = user;

    if (user === 'ADMIN') {
        document.getElementById('admin-panel').style.display = 'block';
    }
    actualizarTodo();
}

// --- 2. ADMIN: CREAR OPCIÓN ---
async function crearOpción() {
    const texto = document.getElementById('new-opt-text').value;
    const cat = parseInt(document.getElementById('new-opt-cat').value);

    if (!texto) return alert("Escribe algo");

    // Supabase pondrá el ID automáticamente gracias al SQL del Paso 1
    const { error } = await client.from('opciones').insert([
        { texto_opcion: texto, categoria: cat }
    ]);

    if (error) alert("Error al crear: " + error.message);
    else {
        document.getElementById('new-opt-text').value = "";
        actualizarTodo();
    }
}

// --- 3. USUARIO: VOTAR ---
async function votar(idOpcion, cat) {
    const user = localStorage.getItem('usuario');
    if (user === 'ADMIN') return;

    // Comprobar si ya votó en esa categoría (2 o 3)
    const { data: misVotos } = await client.from('respuestas')
        .select('opciones(categoria)')
        .eq('nombre_usuario', user);
    
    // Filtramos para ver si ya tiene una de esta categoría
    const yaTiene = misVotos.some(v => v.opciones.categoria === cat);

    if (yaTiene) {
        alert(`¡Ya has elegido una opción de ${cat} puntos!`);
        return;
    }

    const { error } = await client.from('respuestas').insert([
        { nombre_usuario: user, opcion_id: idOpcion }
    ]);

    if (error) alert("Error: " + error.message);
    actualizarTodo();
}

// --- 4. ADMIN: RESOLVER (SI/NO) ---
async function resolver(id, esCorrecta, puntos) {
    if(!confirm("¿Confirmar resultado?")) return;

    // 1. Marcar la opción
    await client.from('opciones').update({ es_correcta: esCorrecta }).eq('id', id);

    // 2. Si es correcta, dar puntos
    if (esCorrecta) {
        const { data: acertantes } = await client.from('respuestas')
            .select('nombre_usuario')
            .eq('opcion_id', id)
            .eq('procesada', false);

        for (let voto of acertantes) {
            // Obtener puntos actuales
            const { data: u } = await client.from('clasificacion')
                .select('puntos').eq('nombre', voto.nombre_usuario).single();
            
            // Sumar
            await client.from('clasificacion')
                .update({ puntos: u.puntos + puntos })
                .eq('nombre', voto.nombre_usuario);
            
            // Marcar voto como procesado
            await client.from('respuestas')
                .update({ procesada: true })
                .eq('nombre_usuario', voto.nombre_usuario)
                .eq('opcion_id', id);
        }
        alert("¡Puntos sumados a los acertantes!");
    }
    actualizarTodo();
}

// --- 5. ADMIN: LIMPIAR JORNADA ---
async function limpiarJornada() {
    if(!confirm("¿Seguro? Se borrarán las opciones pero se mantienen los puntos.")) return;
    const { error } = await client.rpc('limpiar_jornada');
    if(error) alert("Error: " + error.message);
    else {
        alert("Jornada limpia.");
        actualizarTodo();
    }
}

// --- 6. CARGAR DATOS (MOTOR DE LA PANTALLA) ---
async function actualizarTodo() {
    const user = localStorage.getItem('usuario');
    
    // A) Cargar Opciones
    const { data: opciones } = await client.from('opciones').select('*').order('id');
    const { data: misVotos } = await client.from('respuestas').select('opcion_id').eq('nombre_usuario', user);
    const votadas = misVotos.map(v => v.opcion_id);

    let html = "";
    opciones.forEach(op => {
        let clase = votadas.includes(op.id) ? "elegida" : "";
        let estado = "";
        if (op.es_correcta === true) estado = "✅";
        if (op.es_correcta === false) estado = "❌";

        html += `<div class="btn-option ${clase}" onclick="${op.es_correcta === null ? `votar(${op.id}, ${op.categoria})` : ''}">
            <b>[${op.categoria} pts]</b> ${op.texto_opcion} ${estado}`;
        
        if (user === 'ADMIN' && op.es_correcta === null) {
            html += `<br><br>
            <button onclick="event.stopPropagation(); resolver(${op.id}, true, ${op.categoria})">SÍ</button> 
            <button onclick="event.stopPropagation(); resolver(${op.id}, false, ${op.categoria})">NO</button>`;
        }
        html += `</div>`;
    });
    document.getElementById('options-container').innerHTML = html || "No hay opciones activas.";

    // B) Cargar Ranking
    const { data: ranking } = await client.from('clasificacion').select('*').order('puntos', { ascending: false });
    document.getElementById('ranking-container').innerHTML = ranking.map((j, i) => 
        `<div class="ranking-row"><span>${i+1}. ${j.nombre}</span> <b>${j.puntos} pts</b></div>`
    ).join('');
}

function salir() {
    localStorage.removeItem('usuario');
    location.reload();
}

// Auto-arranque si ya estaba logueado
if (localStorage.getItem('usuario')) mostrarJuego(localStorage.getItem('usuario'));
