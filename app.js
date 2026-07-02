/*
====================================================
Talent Simulator - app.js
Duas árvores, escolha inicial e desbloqueio secundário
====================================================
*/

const primaryTreeSelect = document.getElementById("primaryTree");
const availablePointsInput = document.getElementById("availablePoints");
const spentPointsLabel = document.getElementById("spentPoints");
const remainingPointsLabel = document.getElementById("remainingPoints");
const secondaryUnlockedPointsLabel = document.getElementById("secondaryUnlockedPoints");

const tooltip = document.getElementById("tooltip");
const tooltipTitle = tooltip.querySelector(".tooltip-title");
const tooltipDescription = tooltip.querySelector(".tooltip-description");

const tierTemplate = document.getElementById("tierTemplate");
const talentTemplate = document.getElementById("talentTemplate");
const resetButton = document.getElementById("resetButton");

const treeContainers = {
    support: document.getElementById("supportTree"),
    combat: document.getElementById("combatTree")
};

const treePanels = {
    support: document.querySelector('[data-tree-panel="support"]'),
    combat: document.querySelector('[data-tree-panel="combat"]')
};

let hoveredTalentContext = null;

window.addEventListener("DOMContentLoaded", async () => {

    await loadAllTrees();

    const loaded = loadBuildFromLocalStorage();

    if (loaded) {
        availablePointsInput.value = getAvailablePoints();
    
        if (getPrimaryTree()) {
            primaryTreeSelect.value = getPrimaryTree();
        }
    } else {
        setAvailablePoints(availablePointsInput.value);
    }    

    availablePointsInput.addEventListener("input", () => {
        setAvailablePoints(availablePointsInput.value);
        refreshAll();
        saveBuildToLocalStorage();
    });

    primaryTreeSelect.addEventListener("change", () => {
        if (primaryTreeSelect.value === "")
            return;

        setPrimaryTree(primaryTreeSelect.value);
        refreshAll();
        saveBuildToLocalStorage();
    });

    buildAllTrees();
    refreshAll();
    saveBuildToLocalStorage();

});

function buildAllTrees() {
    buildTree("support");
    buildTree("combat");
}

function buildTree(treeId) {

    const container = treeContainers[treeId];
    const tree = TalentTrees[treeId];

    if (!container)
        throw new Error("Container não encontrado: " + treeId);

    if (!tree)
        throw new Error("Dados da árvore não encontrados: " + treeId);

    container.innerHTML = "";

    tree.tiers.forEach(tier => {

        const tierNode = tierTemplate.content.cloneNode(true);

        tierNode.querySelector(".tierLevel").textContent =
            "Lv." + tier.level;

        const talentContainer =
            tierNode.querySelector(".tierTalents");

        tier.talents.forEach(talent => {
            talentContainer.appendChild(
                createTalentNode(treeId, talent, tier)
            );
        });

        container.appendChild(tierNode);

    });

}

function createTalentNode(treeId, talent, tier) {

    const node =
        talentTemplate.content.firstElementChild.cloneNode(true);

    node.dataset.tree = treeId;
    node.dataset.id = talent.id;
    node.dataset.level = tier.level;

    const img = node.querySelector(".talentIcon");
    img.src = getTalentIcon(talent.id);
    img.alt = talent.name;
    
    img.onerror = function () {
        this.onerror = null;
        this.src = "trees/icons/placeholder.png";
    };
    
    node.addEventListener("click", () => {

        if (!canAllocatePoint(treeId, tier.level))
            return;
    
        if (talent.points >= talent.maxPoints)
            return;
    
        talent.points++;
    
        updateTalentVisual(node, treeId, talent, tier);
        refreshAll();
        saveBuildToLocalStorage();
    
    });

    node.addEventListener("contextmenu", event => {

        event.preventDefault();
    
        if (talent.points <= 0)
            return;
    
        talent.points--;
    
        updateTalentVisual(node, treeId, talent, tier);
        refreshAll();
        saveBuildToLocalStorage();
    
    });

    node.addEventListener("mouseenter", () => {
        hoveredTalentContext = {
            treeId,
            talent,
            tier
        };
    
        showTooltip(treeId, talent, tier);
    });

    node.addEventListener("mouseleave", () => {
        hoveredTalentContext = null;
        hideTooltip();
    });

    node.addEventListener("mousemove", moveTooltip);

    updateTalentVisual(node, treeId, talent, tier);

    return node;

}

function refreshAll() {

    refreshTreePanels();
    refreshTalents();
    updateCounters();

    if (hoveredTalentContext) {
        showTooltip(
            hoveredTalentContext.treeId,
            hoveredTalentContext.talent,
            hoveredTalentContext.tier
        );
    }

}

function refreshTreePanels() {

    Object.keys(treePanels).forEach(treeId => {

        const panel = treePanels[treeId];

        if (!panel)
            return;

        panel.classList.remove(
            "primaryTree",
            "secondaryTree",
            "lockedTree"
        );

        if (!getPrimaryTree()) {
            panel.classList.add("lockedTree");
            return;
        }

        if (isPrimaryTree(treeId)) {
            panel.classList.add("primaryTree");
            return;
        }

        if (isSecondaryTree(treeId)) {
            panel.classList.add("secondaryTree");

            if (!isTreeUnlocked(treeId)) {
                panel.classList.add("lockedTree");
            }
        }

    });

}

function refreshTalents() {

    document.querySelectorAll(".talent").forEach(node => {

        const treeId = node.dataset.tree;
        const talentId = node.dataset.id;
        const level = Number(node.dataset.level);

        const talent = getTalent(treeId, talentId);
        const tree = TalentTrees[treeId];

        if (!talent || !tree)
            return;

        const tier = tree.tiers.find(t => t.level === level);

        if (!tier)
            return;

        updateTalentVisual(node, treeId, talent, tier);

    });

}

function updateTalentVisual(node, treeId, talent, tier) {

    const counter = node.querySelector(".talentPoints");
    const arrow = node.querySelector(".upgradeArrow");

    if (counter) {
        counter.textContent = `${talent.points}/${talent.maxPoints}`;
    }

    node.classList.remove("selected", "maxed", "locked", "unlocked", "allocatable");

    if (talent.points > 0) {
        node.classList.add("selected");
    }

    if (talent.points >= talent.maxPoints) {
        node.classList.add("maxed");
    }

    if (!isTierUnlocked(treeId, tier.level)) {
        node.classList.add("locked");
    } else {
        node.classList.add("unlocked");
    
        if (canAllocatePoint(treeId, tier.level) && talent.points < talent.maxPoints) {
            node.classList.add("allocatable");
        }
    }

    if (arrow) {
        if (talent.points >= talent.maxPoints || !canAllocatePoint(treeId, tier.level)) {
            arrow.style.display = "none";
        } else {
            arrow.style.display = "block";
        }
    }
}

function updateCounters() {

    spentPointsLabel.textContent =
        getSpentPoints();

    remainingPointsLabel.textContent =
        getRemainingPoints();

    secondaryUnlockedPointsLabel.textContent =
        getSecondaryTreeUnlockedPoints();

}

function showTooltip(treeId, talent, tier) {

    tooltip.classList.remove("hidden");

    tooltipTitle.textContent = talent.name;

    let html = "";

    html += getTalentDescription(talent);

    html += "<br><br>";
    html += "<strong>";
    html += talent.points + "/" + talent.maxPoints;
    html += "</strong>";

    if (!getPrimaryTree()) {
        html += "<br><br><span style='color:#ff6666'>Choose an specialization.</span>";
    } else if (!isTreeUnlocked(treeId)) {
        html += "<br><br><span style='color:#ff6666'>Specialization is blocked.</span>";
    } else if (getAvailablePoints() < tier.level) {

        html += "<br><br><span style='color:#ff6666'>Tier locked.</span>";
        html += "<br>Require level ";
        html += tier.level;
        html += ".";
    } else if (!isTierUnlocked(treeId, tier.level)) {
        html += "<br><br><span style='color:#ff6666'>Mastery locked.</span>";
        html += "<br>Requires ";
        html += getRequiredPoints(tier.level);
        html += " points spent in previous nodes.";
    } else if (isSecondaryTree(treeId)) {
        html += "<br><br>";
        html += "Points unlocked for secondary specialization: ";
        html += getSecondaryTreeUnlockedPoints();
        html += "<br><br>";
        html += "Remaining points for secondary specialization: ";
        html += getSecondaryTreeRemainingPoints();
    }

    tooltipDescription.innerHTML = html;

}

function hideTooltip() {
    tooltip.classList.add("hidden");
}

function moveTooltip(event) {

    const padding = 16;

    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    let left = event.clientX + 20;
    let top = event.clientY + 20;

    if (left + tooltipWidth + padding > window.innerWidth) {
        left = event.clientX - tooltipWidth - 20;
    }

    if (top + tooltipHeight + padding > window.innerHeight) {
        top = event.clientY - tooltipHeight - 20;
    }

    if (left < padding) {
        left = padding;
    }

    if (top < padding) {
        top = padding;
    }

    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";

}

resetButton.addEventListener("click", () => {

    if (!confirm("Resetar as duas árvores e escolher novamente?"))
        return;

    resetTrees();
    refreshAll();
    saveBuildToLocalStorage();

});