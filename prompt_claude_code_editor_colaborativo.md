# Prompt maestro para Claude Code
## Proyecto: editor de código colaborativo self-hosted con subagentes

Quiero que actúes como un **equipo de ingeniería senior coordinado por subagentes especializados** y construyas un **MVP funcional** de un editor de código colaborativo en tiempo real, **self-hosted**, listo para correr en mi propia máquina.

---

## 1. Objetivo del producto

Construir una plataforma web donde **múltiples usuarios puedan editar el mismo archivo de código al mismo tiempo**, con:

- sincronización en tiempo real
- reconexión automática
- persistencia local
- recuperación de estado
- cero lógica de overwrite/merge manual estilo Firebase

La meta es evitar el problema clásico de:
- “overwrite”
- “merge conflict manual”
- “último en guardar gana”

Quiero una experiencia más parecida a:
- Google Docs
- Live Share
- editores colaborativos reales

---

## 2. Restricciones obligatorias

Estas decisiones **NO son opcionales**:

- **Frontend:** Next.js
- **Editor:** Monaco Editor
- **Motor colaborativo:** Yjs
- **Transporte realtime:** servidor WebSocket separado
- **Persistencia:** snapshots o estado guardados localmente
- **Deploy local:** Docker Compose
- **Lenguaje preferido:** TypeScript
- **Hosting:** self-hosted en mi propia máquina
- **Fuente de verdad del documento colaborativo:** Yjs

### Prohibiciones
- **NO usar Firebase**
- **NO usar Firestore**
- **NO usar Supabase Realtime como motor principal del documento**
- **NO usar una base de datos como fuente de verdad del contenido colaborativo**
- **NO guardar el archivo completo en cada tecla como mecanismo principal**
- **NO implementar un fake realtime basado en reemplazar strings enteros**
- **NO resolver concurrencia con overwrite**
- **NO resolver concurrencia con prompts manuales de merge**
- **NO reemplazar Yjs por una implementación casera**
- **NO meter frameworks extra innecesarios**
- **NO complicar esta versión con auth compleja**
- **NO meter Git integration todavía**
- **NO meter ejecución remota de código todavía**
- **NO meter un file explorer complejo estilo VS Code todavía**
- **NO meter features fuera del MVP si agregan complejidad**

---

## 3. Prioridad técnica

Quiero una solución **correcta para colaboración de texto/código concurrente**.

Si en algún momento hay conflicto entre:
- implementar rápido
- implementar correctamente la colaboración

**priorizá siempre la implementación correcta del motor colaborativo**.

Quiero evitar a toda costa una arquitectura que:
- sincronice strings completos
- use “save document” como mecanismo de colaboración
- derive en conflictos manuales como me pasaba antes

---

## 4. Qué quiero que construyas

Quiero un **MVP** con estas capacidades mínimas:

1. abrir un archivo de código en una interfaz web
2. editarlo en Monaco
3. abrir la misma room/archivo en dos navegadores distintos
4. ver sincronización en tiempo real entre ambos
5. tolerar reconexión sin perder cambios
6. mostrar presencia básica de usuarios conectados
7. persistir snapshots o estado del documento localmente
8. restaurar el documento cuando el servidor reinicie
9. poder levantar todo con Docker Compose
10. dejar una base limpia para seguir evolucionándolo

---

## 5. Arquitectura deseada

Quiero una arquitectura **modular, simple y mantenible**.

Proponé y construí algo cercano a esto:

```txt
/apps/web          -> frontend Next.js
/services/collab   -> servidor websocket / rooms / Yjs
/storage           -> snapshots / documentos persistidos localmente
/infra             -> docker compose / configuración local
```

Podés ajustar nombres si hay una razón técnica clara, pero mantené separación de responsabilidades.

---

## 6. Comportamiento esperado del sistema

- Cada archivo debe comportarse como una **room colaborativa**
- Dos usuarios conectados al mismo archivo deben ver los cambios en tiempo real
- Los cambios concurrentes deben fusionarse automáticamente mediante **Yjs**
- Si un usuario se desconecta momentáneamente, al reconectar debe resincronizar
- Debe existir una estrategia simple de persistencia periódica o por debounce
- Debe poder restaurarse el último estado persistido al reiniciar el servidor
- La persistencia no debe romper la convergencia del documento

---

## 7. Decisiones técnicas preferidas

- TypeScript en todo lo posible
- estructura limpia
- dependencias razonables
- código legible
- comentarios solo donde aporten valor real
- scripts claros para desarrollo local
- variables de entorno bien definidas
- README útil y accionable
- logs mínimos pero útiles para debug
- diseño inicial simple, sin sobreingeniería

---

## 8. Subagentes obligatorios

Quiero que trabajes como si fueras un equipo real con **subagentes especializados**.  
Dividí el trabajo explícitamente.

Como mínimo, usá estos subagentes:

### 8.1. Arquitecto de sistema
Responsabilidades:
- definir la estructura del proyecto
- definir el flujo de sincronización
- definir el modelo room/documento
- definir cómo persiste y restaura el documento
- asegurar que Yjs sea la fuente de verdad
- detectar decisiones que puedan romper el modelo CRDT

### 8.2. Subagente Frontend
Responsabilidades:
- implementar Next.js
- integrar Monaco Editor
- conectar la UI con el documento colaborativo
- mostrar presencia básica
- mantener una UX limpia y estable

### 8.3. Subagente Realtime / Collaboration
Responsabilidades:
- implementar el servidor WebSocket
- manejar rooms por archivo
- integrar Yjs
- implementar sincronización
- implementar awareness/presencia básica
- validar que no aparezcan conflictos manuales

### 8.4. Subagente Persistencia
Responsabilidades:
- diseñar la estrategia de snapshots/guardado local
- implementar restore al iniciar
- evitar corrupción de archivos
- pensar debounce/autosave
- validar compatibilidad con Yjs

### 8.5. Subagente DevOps local
Responsabilidades:
- preparar Docker Compose
- configurar puertos y volúmenes
- definir scripts de arranque
- asegurar que todo corra self-hosted
- documentar cómo levantar el entorno

### 8.6. Subagente QA / Troubleshooting
Responsabilidades:
- verificar flujo entre 2 clientes
- validar reconexión
- detectar puntos frágiles
- proponer fixes concretos
- validar criterios de aceptación

---

## 9. Forma de trabajo obligatoria

No quiero que intentes hacer todo de golpe.

Quiero que trabajes en **fases cortas**, y en cada fase indiques claramente:

1. qué fase estás ejecutando
2. qué subagentes participan
3. qué archivos vas a crear o modificar
4. por qué
5. cuál es el resultado esperado
6. cómo probarlo

---

## 10. Fases obligatorias

### Fase 0 - Diseño
Antes de escribir código:

- explicá la arquitectura elegida
- explicá el flujo de sincronización
- explicá cómo se persiste y restaura
- explicá cómo se representa una room/documento
- explicá qué librerías exactas vas a usar y por qué
- explicá riesgos principales y mitigaciones

### Fase 1 - Scaffold del proyecto
- crear estructura base de carpetas
- configurar frontend
- configurar servicio collab
- preparar package.json / tsconfig / variables de entorno
- preparar docker compose base

### Fase 2 - Servidor colaborativo
- implementar servidor websocket
- integrar Yjs
- soportar rooms por archivo
- agregar awareness/presencia básica
- dejar logs simples para debug

### Fase 3 - Editor web
- integrar Monaco en Next.js
- conectar un archivo a una room
- sincronizar cambios con Yjs
- asegurar experiencia estable con dos navegadores

### Fase 4 - Persistencia local
- guardar snapshots o estado de documentos localmente
- restaurar documentos al reinicio
- definir estrategia de guardado razonable

### Fase 5 - Reconexión y robustez
- validar comportamiento ante caída/reconexión
- mejorar manejo de errores
- asegurar que no se pierdan cambios fácilmente
- validar estabilidad mínima del MVP

### Fase 6 - Docker y README
- dejar todo levantable con Docker Compose
- documentar cómo correrlo
- documentar limitaciones actuales del MVP
- documentar próximos pasos recomendados

---

## 11. Reglas de implementación

- no inventes features que no pedí si agregan complejidad
- no agregues auth compleja en esta primera versión
- no agregues base de datos si no es estrictamente necesaria
- no metas ejecución remota de código
- no metas explorer complejo
- no metas Git integration
- el foco es **colaboración estable sobre un archivo**
- si algo no está claro, elegí la opción más simple que preserve el modelo colaborativo correcto

---

## 12. Criterios de aceptación

El trabajo se considera aceptable solo si:

- puedo abrir el mismo archivo en 2 navegadores
- ambos ven los cambios en tiempo real
- no aparece lógica de overwrite/merge manual
- el documento se recupera luego de reiniciar el servicio
- todo corre localmente en mi máquina
- la solución queda estructurada para crecer después
- Yjs sigue siendo la fuente de verdad del documento

---

## 13. Qué espero en cada respuesta

En cada iteración, respondé con esta estructura exacta:

### 1. Resumen de la fase actual
### 2. Subagentes involucrados
### 3. Decisiones técnicas
### 4. Archivos a crear/modificar
### 5. Código
### 6. Cómo probar
### 7. Riesgos o limitaciones
### 8. Próximo paso

---

## 14. Validación continua obligatoria

En cada fase verificá explícitamente que:

- Yjs sigue siendo la fuente de verdad
- no caíste en un enfoque de overwrite de string completo
- la sincronización sigue siendo realmente colaborativa
- la persistencia no rompe la convergencia del documento
- la reconexión no genera pérdida innecesaria de cambios

---

## 15. Qué hacer si detectás una mala decisión

Si durante la implementación detectás que una decisión rompe el modelo colaborativo correcto:

1. frená
2. explicá claramente el problema
3. proponé una alternativa correcta
4. seguí por el camino correcto aunque sea un poco más largo

No priorices velocidad por encima de consistencia arquitectónica.

---

## 16. Entregable final esperado

Quiero terminar con:

- un proyecto funcional
- estructura clara
- editor colaborativo básico estable
- persistencia local
- docker compose
- instrucciones para correrlo
- lista de próximos pasos para convertirlo en algo más serio

---

## 17. Instrucciones operativas adicionales

- trabajá con mentalidad de **tech lead + equipo multiagente**
- coordiná a los subagentes antes de cada fase
- consolidá una única propuesta coherente
- no des respuestas genéricas
- dame decisiones concretas, archivos concretos y código concreto
- no reescribas todo desde cero en cada fase
- continuá sobre lo ya implementado
- mantené consistencia con decisiones previas aprobadas

---

## 18. Recordatorio de restricciones

Recordatorio permanente:

- No Firebase
- No Firestore
- No fake realtime
- No guardar strings completos como motor de sincronización
- No reemplazar Yjs por lógica propia
- No features fuera del MVP
- No auth compleja todavía
- No Git integration todavía
- No ejecución remota todavía
- No inventar atajos que rompan el modelo CRDT

---

## 19. Instrucción inicial obligatoria

Ahora empezá por la **Fase 0: Diseño**.

No saltees directamente a escribir código.
Primero diseñá y justificá la arquitectura.
Después esperá aprobación antes de avanzar a implementación.
