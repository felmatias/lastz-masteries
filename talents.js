/*
=========================================================
Talent Simulator - talents.js
Regras e dados globais do simulador
=========================================================
*/

let TalentTrees = {
    support: null,
    combat: null
};

let AvailablePoints = 60;
let PrimaryTreeId = null;

/*
=========================================================
Carregamento das árvores
=========================================================
*/

async function loadTreeFromFile(treeId, filePath) {

    const response = await fetch(filePath);

    if (!response.ok)
        throw new Error("Erro ao carregar: " + filePath);

    TalentTrees[treeId] = await response.json();

}

async function loadAllTrees() {

    await loadTreeFromFile("support", "trees/support.json");
    await loadTreeFromFile("combat", "trees/combat.json");

}

/*
=========================================================
Árvore inicial
=========================================================
*/

function setPrimaryTree(treeId) {

    if (!TalentTrees[treeId])
        throw new Error("Árvore inválida: " + treeId);

    PrimaryTreeId = treeId;

}

function getPrimaryTree() {

    return PrimaryTreeId;

}

function getSecondaryTree() {

    if (!PrimaryTreeId)
        return null;

    return PrimaryTreeId === "support" ? "combat" : "support";

}

function isPrimaryTree(treeId) {

    return treeId === PrimaryTreeId;

}

function isSecondaryTree(treeId) {

    return treeId === getSecondaryTree();

}

/*
=========================================================
Pontos disponíveis
=========================================================
*/

function setAvailablePoints(points) {

    AvailablePoints = Math.max(0, Number(points) || 0);

}

function getAvailablePoints() {

    return AvailablePoints;

}

/*
=========================================================
Requisitos por nível
Lv.1  = 0
Lv.5  = 0
Lv.10 = 5
Lv.15 = 5
Lv.20 = 10
=========================================================
*/

function getRequiredPoints(level) {

    if (level < 10)
        return 0;

    const previousMultipleOfTen =
        Math.floor(level / 10) * 10;

    return previousMultipleOfTen / 2;

}

function getSpentPointsInPreviousLevels(treeId, level) {

    const tree = TalentTrees[treeId];

    let total = 0;

    for (const tier of tree.tiers) {

        if (tier.level >= level)
            continue;

        for (const talent of tier.talents) {
            total += talent.points;
        }

    }

    return total;

}

function isTierUnlocked(treeId, level) {

    if (!PrimaryTreeId)
        return false;

    if (!isTreeUnlocked(treeId))
        return false;

    if (getAvailablePoints() < level)
        return false;

    return getSpentPointsInPreviousLevels(treeId, level) >=
        getRequiredPoints(level);

}

/*
=========================================================
Regra da segunda árvore
A segunda árvore fica bloqueada até investir pontos
em talentos de Lv.50 da árvore principal.

Cada ponto investido em Lv.50 da árvore principal libera
5 pontos para uso na árvore secundária.
=========================================================
*/

function isTreeUnlocked(treeId) {

    if (!PrimaryTreeId)
        return false;

    if (isPrimaryTree(treeId))
        return true;

    if (isSecondaryTree(treeId))
        return getSecondaryTreeUnlockedPoints() > 0;

    return false;

}

function getSecondaryTreeUnlockedPoints() {

    if (!PrimaryTreeId)
        return 0;

    const primaryTree = TalentTrees[PrimaryTreeId];

    let level50Points = 0;

    for (const tier of primaryTree.tiers) {

        if (tier.level !== 50)
            continue;

        for (const talent of tier.talents) {
            level50Points += talent.points;
        }

    }

    return level50Points * 5;

}

function getSecondaryTreeRemainingPoints() {

    const secondaryTreeId = getSecondaryTree();

    if (!secondaryTreeId)
        return 0;

    return Math.max(
        0,
        getSecondaryTreeUnlockedPoints() - getSpentPointsInTree(secondaryTreeId)
    );

}

/*
=========================================================
Contagem de pontos
=========================================================
*/

function getSpentPointsInTree(treeId) {

    const tree = TalentTrees[treeId];

    if (!tree)
        return 0;

    let total = 0;

    for (const tier of tree.tiers) {

        for (const talent of tier.talents) {
            total += talent.points;
        }

    }

    return total;

}

function getSpentPoints() {

    return getSpentPointsInTree("support") +
           getSpentPointsInTree("combat");

}

function getRemainingPoints() {

    if (!PrimaryTreeId)
        return AvailablePoints;

    return Math.max(
        0,
        AvailablePoints - getSpentPoints()
    );

}

/*
=========================================================
Permissão para adicionar pontos
=========================================================
*/

function canAllocatePoint(treeId, level) {

    if (!isTierUnlocked(treeId, level))
        return false;

    return getRemainingPoints() > 0;
}

/*
=========================================================
Busca de talentos
=========================================================
*/

function getTalent(treeId, talentId) {

    const tree = TalentTrees[treeId];

    if (!tree)
        return null;

    for (const tier of tree.tiers) {

        for (const talent of tier.talents) {

            if (talent.id === talentId)
                return talent;

        }

    }

    return null;

}

/*
=========================================================
Reset
=========================================================
*/

function resetTrees() {

    for (const treeId in TalentTrees) {

        const tree = TalentTrees[treeId];

        if (!tree)
            continue;

        for (const tier of tree.tiers) {

            for (const talent of tier.talents) {
                talent.points = 0;
            }

        }

    }

    PrimaryTreeId = null;

}

function getTalentIcon(talentId) {
    return `trees/icons/${talentId}.png`;
}

const STORAGE_KEY = "lastz_talent_simulator_v01";

function saveBuildToLocalStorage() {
    const data = {
        availablePoints: AvailablePoints,
        primaryTreeId: PrimaryTreeId,
        trees: {}
    };

    for (const treeId in TalentTrees) {
        data.trees[treeId] = [];

        for (const tier of TalentTrees[treeId].tiers) {
            for (const talent of tier.talents) {
                data.trees[treeId].push({
                    id: talent.id,
                    points: talent.points
                });
            }
        }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadBuildFromLocalStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw)
        return false;

    const data = JSON.parse(raw);

    setAvailablePoints(data.availablePoints);
    PrimaryTreeId = data.primaryTreeId;

    for (const treeId in data.trees) {
        for (const savedTalent of data.trees[treeId]) {
            const talent = getTalent(treeId, savedTalent.id);

            if (talent) {
                talent.points = savedTalent.points;
            }
        }
    }

    return true;
}

function clearBuildFromLocalStorage() {
    localStorage.removeItem(STORAGE_KEY);
}

function getTalentDescription(talent) {

    let description = talent.description;

    if (!talent.levels)
        return description;

    const currentLevel = Math.max(1, talent.points);

    const value =
        talent.levels[currentLevel] ??
        talent.levels[String(currentLevel)];

    if (!value)
        return description;

    return description.replace(/###/g, value);

}