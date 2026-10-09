// Déplacer un bâtiment (choix de l'auteur, 9 oct. : « disposer mes bâtiments où je veux, comme je veux ») : sa grande
// emprise (3 × 3, la place où il grandira) va où le joueur la pose, gratuitement, si toutes ses cases sont libres :
// dans ses quartiers, sur l'herbe, le sable ou la prairie (ni chemin, ni eau), hors des autres bâtiments, du camp, des
// annexes, des créations posées, des lieux remarquables, des gisements, des trouvailles de la plage et des panneaux de
// quartier. Une création posée « près de » lui (nearSite) doit rester à sa portée. Son quartier (celui qu'il faut
// acheter pour le bâtir) ne change pas. La place est gardée dans world_site_places (world/places.js).
const db = require('../../config/db');
const map = require('../worldMap');
const crafts = require('../crafts');
const landmarks = require('../landmarks');
const finds = require('../finds');
const pickups = require('../pickups');
const { SIZE, SITES, keyOf } = require('./rules');
const { annexesOf, levelsOf, zonesOf, craftsOf, placedOf, stockOf } = require('./reads');
const { migrate } = require('./migrate');
const { BIG, footprintAt, inSiteAt, placesOf } = require('./places');
const { campOfUser, cellsOfCamp } = require('./camp');
const { roadsOf } = require('./paths');

// Cases réservées pour toujours : trouvailles de la plage, panneaux des quartiers
const FIXED = new Set([...pickups.SPOTS, ...Object.values(map.ANCHORS).filter(Boolean)].map(keyOf));

// Ce qui empêche de poser la grande emprise de siteId avec son coin en (x, y) (texte), ou null. ctx : { places, levels,
// zones (à soi), ground(x, y) (le sol du joueur, ses chemins compris), taken (clés prises : camp, annexes, créations) ,
// placed ([{ x, y, craft }] créations posées) }
function moveBlock(siteId, x, y, ctx) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + BIG > SIZE || y + BIG > SIZE) return 'Hors de l’île.';
    for (let dy = 0; dy < BIG; dy++) {
        for (let dx = 0; dx < BIG; dx++) {
            const cx = x + dx, cy = y + dy;
            if (!ctx.zones.has(map.zoneAt(cx, cy))) return 'Pose-le dans tes quartiers.';
            if (!['g', 's', 'm'].includes(ctx.ground(cx, cy))) return 'Il se pose sur l’herbe, le sable ou la prairie (pas sur un chemin).';
            const key = keyOf({ x: cx, y: cy });
            if (inSiteAt(ctx.places, cx, cy, siteId) || ctx.taken.has(key) || FIXED.has(key) || landmarks.isLandmark(cx, cy) || finds.isDeposit(cx, cy)) {
                return 'La place est prise.';
            }
        }
    }
    // Les créations qui doivent rester près de lui
    const moved = { ...ctx.places, [siteId]: { x, y } };
    const at = footprintAt(moved, siteId, ctx.levels[siteId] || 0);
    const far = ctx.placed.find(p => {
        const near = crafts.CRAFT_BY_ID[p.craft]?.place.nearSite;
        return near && near.id === siteId && crafts.gapTo(p.x, p.y, at) > near.reach;
    });
    if (far) return `« ${crafts.CRAFT_BY_ID[far.craft].name} » doit rester près de lui : déplace-la d’abord.`;
    return null;
}

// Ce que moveBlock lit, d'après la base
async function moveCtx(userId, conn) {
    const { levels } = await levelsOf(userId, conn);
    const annexRows = await annexesOf(userId, conn);
    const craftRows = await craftsOf(userId, conn);
    const placed = placedOf(craftRows);
    const camp = cellsOfCamp(await campOfUser(userId, conn, { levels, annexRows, craftRows }));
    const { ground } = await roadsOf(userId, conn);
    const { places } = await placesOf(userId, conn);
    return {
        places, levels, zones: await zonesOf(userId, conn), ground, placed,
        taken: new Set([...camp, ...annexRows.map(keyOf), ...placed.map(keyOf)])
    };
}

// Les coins où ce bâtiment peut aller maintenant : [{ x, y }] (sa place actuelle comprise), des plus proches aux plus
// lointains. { spots } ou { status, message }
async function siteSpots(userId, siteId) {
    if (!Object.hasOwn(SITES, siteId)) return { status: 404, message: 'Bâtiment inconnu.' };
    await migrate(userId);
    const ctx = await moveCtx(userId, db);
    const from = ctx.places[siteId];
    const spots = [];
    for (let y = 0; y + BIG <= SIZE; y++) {
        for (let x = 0; x + BIG <= SIZE; x++) {
            if (!ctx.zones.has(map.zoneAt(x, y)) || moveBlock(siteId, x, y, ctx)) continue;
            spots.push({ x, y, d: Math.hypot(x - from.x, y - from.y) });
        }
    }
    return { spots: spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x).map(({ x, y }) => ({ x, y })) };
}

// Pose la grande emprise de siteId avec son coin en (x, y). {} ou { status, message }
async function moveSite(userId, siteId, x, y) {
    if (!Object.hasOwn(SITES, siteId)) return { status: 404, message: 'Bâtiment inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        // (la ligne de stock verrouillée : deux poses sur l'île ne se croisent pas)
        await stockOf(userId, conn, true);
        const ctx = await moveCtx(userId, conn);
        const from = ctx.places[siteId];
        if (from.x === x && from.y === y) return {};
        const block = moveBlock(siteId, x, y, ctx);
        if (block) return db.rollback({ status: 400, message: block });
        await conn.query(
            `INSERT INTO world_site_places (user_id, site, x, y) VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, site) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, moved_at = NOW()`, [userId, siteId, x, y]);
        return {};
    });
}

module.exports = { moveBlock, siteSpots, moveSite };
