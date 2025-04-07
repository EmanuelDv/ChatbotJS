const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }
});

// Objeto para rastrear el estado de la conversación por usuario
const estadosConversacion = {};

client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
    console.log("Escanea este código QR con tu WhatsApp");
});

client.on("ready", () => {
    console.log("¡Pamii-bot conectado a WhatsApp!");
});

client.on("disconnected", (reason) => {
    console.log("Desconectado de WhatsApp:", reason);
});

// Definimos el tiempo de espera: 5 minutos en milisegundos
const TIMEOUT_MINUTES = 5;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;

// Función para configurar o reiniciar el temporizador de un usuario
function setTimeoutForUser(remitente) {
    const estado = estadosConversacion[remitente];
    
    if (estado && estado.timeoutId) {
        clearTimeout(estado.timeoutId);
    }
    
    if (estado && estado.nivel !== "con_asesor") {
        estado.timeoutId = setTimeout(async () => {
            await client.sendMessage(remitente, "Han pasado 5 minutos sin respuesta. La conversación ha expirado. Escribe 'hola' para empezar de nuevo.");
            delete estadosConversacion[remitente];
        }, TIMEOUT_MS);
    }
}

// Funciones de texto para menús
const menus = {
    terminos: `¡Hola! 👋 ¡Bienvenid@! Gracias por ponerte en contacto con nosotros. Antes de iniciar, es necesario que aceptes los términos y condiciones de EstoEsPamii. Si quieres conocer más, ingresa aquí: https://estoespamii.co/www/tycclientes2024.html
    \nPara continuar elige:
    \n1. Acepto
    \n2. No acepto`,
    principal: `¡Hola! 👋 ¡Bienvenid@ a EstoEsPamii! Soy tu asistente virtual, list@ para darte una mano. 😉  
    \nElige una opción:
    \n1. Chatear con un asesor
    \n2. ¿Cómo va mi pedido?
    \n3. Reclamos/Devoluciones
    \n4. ¡Quiero trabajar en Pamii!
    \n5. ¡Chao!
    \nIngresa el número. 👇`,
    asesor: `¡Genial! 😉 ¿Sobre qué necesitas ayuda? Elige una categoría:
    \n1. Quiero comprar / Ver productos
    \n2. Ayuda con mis compras
    \n3. Volver al inicio`,
    pedido: `Seleccione una opción:
    \n1. Consultar por número de pedido 🔍
    \n2. Consultar pedidos recientes 📋
    \n3. Volver al menú principal ⬅️`,
    reclamos: `Seleccione una opción:
    \n1. Registrar un nuevo reclamo ✍️
    \n2. Consultar estado de un reclamo 📊
    \n3. Solicitar devolución 🔙
    \n4. Volver al menú principal ⬅️`,
};

// Definición de los handlers para cada stage
const stageHandlers = {
    inicio: async (message, estado) => {
        await message.reply(menus.terminos);
        estadosConversacion[message.from] = { nivel: "terminos", timeoutId: null }; // Actualizamos directamente
    },
    terminos: async (message, estado) => {
        const opcion = message.body.trim();
        const opciones = {
            "1": { nivel: "principal", respuesta: menus.principal },
            "2": { nivel: null, respuesta: "Acepta los términos y condiciones para continuar" },
        };
        const seleccion = opciones[opcion] || { respuesta: "Opción no válida. Selecciona 1 para aceptar o 2 para rechazar." };
        await message.reply(seleccion.respuesta);
        if (seleccion.nivel === null) {
            delete estadosConversacion[message.from];
        } else if (seleccion.nivel) {
            estadosConversacion[message.from] = { nivel: seleccion.nivel, timeoutId: null }; // Actualizamos el estado completo
        }
    },
    principal: async (message, estado) => {
        const opcion = message.body.trim();
        const opciones = {
            "1": { nivel: "asesor", respuesta: menus.asesor },
            "2": { nivel: "pedido", respuesta: menus.pedido },
            "3": { nivel: "reclamos", respuesta: menus.reclamos },
            "4": { nivel: "esperando_cv", respuesta: "Por favor, adjunta o carga tu hoja de vida." },
            "5": { nivel: null, respuesta: "Conversación finalizada. Escribe 'hola' para iniciar de nuevo." },
        };
        const seleccion = opciones[opcion] || { respuesta: "Opción no válida. Seleccione un número del 1 al 5." };
        await message.reply(seleccion.respuesta);
        if (seleccion.nivel === null) {
            delete estadosConversacion[message.from];
        } else if (seleccion.nivel) {
            estado.nivel = seleccion.nivel;
        }
    },
    asesor: async (message, estado) => {
        const opcion = message.body.trim();
        const opciones = {
            "1": { nivel: "con_asesor", tipo: "ventas", respuesta: "¡Ok! 😉 Un asesor de Ventas y Productos te contactará en breve." },
            "2": { nivel: "con_asesor", tipo: "soporte", respuesta: "¡Ok! 😉 Un asesor de Soporte Técnico te contactará en breve." },
            "3": { nivel: "principal", respuesta: menus.principal },
        };
        const seleccion = opciones[opcion] || { respuesta: "Opción no válida. Seleccione un número del 1 al 3." };
        await message.reply(seleccion.respuesta);
        if (seleccion.nivel) {
            estado.nivel = seleccion.nivel;
            if (seleccion.tipo) estado.tipo = seleccion.tipo;
        }
    },
    pedido: async (message, estado) => {
        const opcion = message.body.trim();
        const opciones = {
            "1": { nivel: "esperando_numero_pedido", respuesta: "Por favor, indique el número de su pedido." },
            "2": { nivel: "pedido", respuesta: ["Consultando sus pedidos recientes... Un momento, por favor.", "No hay pedidos recientes registrados. Si desea, indique un número de pedido específico."] },
            "3": { nivel: "principal", respuesta: menus.principal },
        };
        const seleccion = opciones[opcion] || { respuesta: "Opción no válida. Seleccione un número del 1 al 3." };
        if (Array.isArray(seleccion.respuesta)) {
            for (const msg of seleccion.respuesta) await message.reply(msg);
        } else {
            await message.reply(seleccion.respuesta);
        }
        if (seleccion.nivel) estado.nivel = seleccion.nivel;
    },
    esperando_numero_pedido: async (message, estado) => {
        const numeroPedido = message.body.trim();
        await message.reply(`Gracias. Su pedido es el #${numeroPedido}.`);
        await message.reply("Un asesor está revisando el estado de su pedido. Por favor, espere un momento.");
        estado.nivel = "con_asesor";
        estado.tipo = "pedido";
    },
    reclamos: async (message, estado) => {
        const opcion = message.body.trim();
        const opciones = {
            "1": { nivel: "esperando_descripcion_reclamo", respuesta: "Por favor, describa brevemente su reclamo." },
            "2": { nivel: "esperando_numero_reclamo", respuesta: "Por favor, indique el número de su reclamo." },
            "3": { nivel: "esperando_numero_devolucion", respuesta: "Por favor, indique el número de pedido para la devolución." },
            "4": { nivel: "principal", respuesta: menus.principal },
        };
        const seleccion = opciones[opcion] || { respuesta: "Opción no válida. Seleccione un número del 1 al 4." };
        await message.reply(seleccion.respuesta);
        if (seleccion.nivel) estado.nivel = seleccion.nivel;
    },
    esperando_descripcion_reclamo: async (message, estado) => {
        await message.reply(`Reclamo registrado: "${message.body.trim()}". Un asesor lo revisará pronto.`);
        estado.nivel = "con_asesor";
        estado.tipo = "reclamo";
    },
    esperando_numero_reclamo: async (message, estado) => {
        const numeroReclamo = message.body.trim();
        await message.reply(`Gracias. Su reclamo es el #${numeroReclamo}.`);
        await message.reply("Un asesor está revisando el estado de su reclamo. Por favor, espere un momento.");
        estado.nivel = "con_asesor";
        estado.tipo = "reclamo";
    },
    esperando_numero_devolucion: async (message, estado) => {
        const numeroDevolucion = message.body.trim();
        await message.reply(`Solicitud de devolución para el pedido #${numeroDevolucion} registrada. Un asesor lo contactará pronto.`);
        estado.nivel = "con_asesor";
        estado.tipo = "devolucion";
    },
    esperando_cv: async (message, estado) => {
        if (message.hasMedia) {
            await message.reply("Cargue de CV exitoso. Un asesor lo contactará pronto.");
            estado.nivel = "con_asesor";
            estado.tipo = "cv";
        } else {
            await message.reply("Por favor, envíe un documento con su CV.");
        }
    },
    con_asesor: async (message, estado) => {
        // No responde nada, está con un asesor
    },
};

// Handler principal de mensajes
client.on("message", async (message) => {
    const remitente = message.from;
    const texto = message.body.trim().toLowerCase();

    // Si el usuario escribe "hola", mostrar el menú de términos
    if (texto === "hola") {
        await message.reply(menus.terminos);
        estadosConversacion[remitente] = { nivel: "terminos", timeoutId: null };
        setTimeoutForUser(remitente);
        return;
    }

    // Si escribe "salir", reiniciar estado
    if (texto === "salir" && estadosConversacion[remitente]) {
        await message.reply("Has salido del modo actual. Escribe 'hola' para ver el menú.");
        if (estadosConversacion[remitente].timeoutId) {
            clearTimeout(estadosConversacion[remitente].timeoutId);
        }
        delete estadosConversacion[remitente];
        return;
    }

    // Si no hay estado, mostrar el menú de términos
    if (!estadosConversacion[remitente]) {
        await stageHandlers.inicio(message, {});
        return;
    }

    // Obtener el estado actual y ejecutar el handler correspondiente
    const estado = estadosConversacion[remitente];
    const handler = stageHandlers[estado.nivel] || stageHandlers.inicio;
    await handler(message, estado);

    // Reiniciar el temporizador después de procesar el mensaje
    setTimeoutForUser(remitente);
});

client.initialize();
