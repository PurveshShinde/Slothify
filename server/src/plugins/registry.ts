import type { MetadataPlugin, AudioPlugin } from './interfaces.js';
import { SpotifyScraperPlugin } from './metadata/SpotifyScraperPlugin.js';
import { YouTubeAudioPlugin } from './audio/YouTubeAudioPlugin.js';

class PluginRegistry {
    private metadataPlugins = new Map<string, MetadataPlugin>();
    private audioPlugins = new Map<string, AudioPlugin>();

    private activeMetadataPluginName: string = 'SpotifyScraper';
    private activeAudioPluginName: string = 'YouTubeAudio';

    constructor() {
        // Register default plugins
        const spotifyScraper = new SpotifyScraperPlugin();
        const youtubeAudio = new YouTubeAudioPlugin();

        this.registerMetadataPlugin(spotifyScraper);
        this.registerAudioPlugin(youtubeAudio);
    }

    registerMetadataPlugin(plugin: MetadataPlugin) {
        this.metadataPlugins.set(plugin.name, plugin);
    }

    registerAudioPlugin(plugin: AudioPlugin) {
        this.audioPlugins.set(plugin.name, plugin);
    }

    setActiveMetadataPlugin(name: string) {
        if (!this.metadataPlugins.has(name)) {
            throw new Error(`Metadata plugin "${name}" not registered.`);
        }
        this.activeMetadataPluginName = name;
    }

    setActiveAudioPlugin(name: string) {
        if (!this.audioPlugins.has(name)) {
            throw new Error(`Audio plugin "${name}" not registered.`);
        }
        this.activeAudioPluginName = name;
    }

    getMetadataPlugin(): MetadataPlugin {
        const plugin = this.metadataPlugins.get(this.activeMetadataPluginName);
        if (!plugin) {
            throw new Error(`Active metadata plugin "${this.activeMetadataPluginName}" not found.`);
        }
        return plugin;
    }

    getAudioPlugin(): AudioPlugin {
        const plugin = this.audioPlugins.get(this.activeAudioPluginName);
        if (!plugin) {
            throw new Error(`Active audio plugin "${this.activeAudioPluginName}" not found.`);
        }
        return plugin;
    }
}

export const pluginRegistry = new PluginRegistry();
