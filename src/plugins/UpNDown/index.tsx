/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 me and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import {
    ChannelStore,
    GuildChannelStore,
    PermissionStore,
    PermissionsBits,
    SelectedChannelStore,
    Toasts,
} from "@webpack/common";

const ChannelActions = findByPropsLazy("selectChannel", "selectVoiceChannel");
const log = new Logger("UpNDown");

const settings = definePluginSettings({
    requireFocus: {
        type: OptionType.BOOLEAN,
        description: "Only switch when Discord is focused",
        default: true,
    },
    ignoreWhenTyping: {
        type: OptionType.BOOLEAN,
        description: "Ignore arrow keys while typing in a text box / chat input",
        default: true,
    },
    includeStages: {
        type: OptionType.BOOLEAN,
        description: "Also include Stage channels in the list",
        default: false,
    },
});

function isTypingTarget(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    // Discord's chat box is a contenteditable div with role="textbox"
    if (el.getAttribute("role") === "textbox") return true;
    return false;
}

function getSortedVoiceChannels(guildId: string) {
    const data = GuildChannelStore.getChannels(guildId);
    if (!data?.VOCAL) return [];

    return data.VOCAL
        .map((entry: any) => entry.channel)
        .filter((ch: any) => {
            if (!ch) return false;
            // type 2 = GUILD_VOICE, type 13 = GUILD_STAGE_VOICE
            if (ch.type === 2) return true;
            if (settings.store.includeStages && ch.type === 13) return true;
            return false;
        });
}

function switchVoiceChannel(direction: "up" | "down") {
    const currentId = SelectedChannelStore.getVoiceChannelId();
    if (!currentId) {
        log.debug("Not in a voice channel");
        return;
    }

    const current = ChannelStore.getChannel(currentId);
    if (!current?.guild_id) {
        log.debug("Current channel has no guild");
        return;
    }

    const channels = getSortedVoiceChannels(current.guild_id);
    if (channels.length < 2) return;

    const idx = channels.findIndex((c: any) => c.id === currentId);
    if (idx === -1) return;

    const nextIdx = direction === "up" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= channels.length) {
        return;
    }

    const target = channels[nextIdx];

    if (!PermissionStore.can(PermissionsBits.CONNECT, target)) {
        Toasts.show({
            message: `No permission to join #${target.name}`,
            id: "upndown-no-perm",
            type: Toasts.Type.FAILURE,
            options: { position: Toasts.Position.BOTTOM },
        });
        return;
    }

    ChannelActions.selectVoiceChannel(target.id);
    log.info(`Switched ${direction} → #${target.name}`);
}

function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

    if (settings.store.ignoreWhenTyping && isTypingTarget(e.target)) return;

    if (settings.store.requireFocus && !document.hasFocus()) return;

    e.preventDefault();
    e.stopPropagation();

    switchVoiceChannel(e.key === "ArrowUp" ? "up" : "down");
}

export default definePlugin({
    name: "UpNDown",
    description: "Press ↑ to join the voice channel above yours, ↓ to join the one below. Works with the channel list order.",
    authors: [{ name: "ܓܓܛܓ", id: 950555329266065428n }],
    tags: ["Voice", "Utility", "Keybind"],
    settings,

    start() {
        document.addEventListener("keydown", onKeyDown, true);
        log.info("UpNDown started – use ↑ / ↓ while in a voice channel");
    },

    stop() {
        document.removeEventListener("keydown", onKeyDown, true);
        log.info("UpNDown stopped");
    },
});