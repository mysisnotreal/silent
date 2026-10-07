import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable username larp",
        default: true
    },
    localUsername: {
        type: OptionType.STRING,
        description: "Local username",
        default: ""
    }
});

let originalUsername: string | null = null;
let currentUser: any = null;

function apply() {
    if (!settings.store.enabled || !settings.store.localUsername.trim()) {
        restore();
        return;
    }

    const user = UserStore.getCurrentUser();
    if (!user) return;

    currentUser = user;
    if (originalUsername === null) originalUsername = user.username;

    Object.defineProperty(user, "username", {
        get: () => settings.store.localUsername.trim() || originalUsername,
        set: (v: string) => { originalUsername = v; },
        configurable: true,
        enumerable: true
    });
}

function restore() {
    if (!currentUser || originalUsername === null) return;

    try {
        Object.defineProperty(currentUser, "username", {
            value: originalUsername,
            writable: true,
            configurable: true,
            enumerable: true
        });
    } catch {
        currentUser.username = originalUsername;
    }
}

export default definePlugin({
    name: "larpeth",
    description: "Change your username locally. Does not affect display name.",
    authors: [{ name: "ܓܓܛܓ", id: 950555329266065428n }],
    settings,

    start() {
        apply();
        this.unsub = UserStore.addChangeListener(apply);
    },

    stop() {
        this.unsub?.();
        restore();
        originalUsername = null;
        currentUser = null;
    }
});