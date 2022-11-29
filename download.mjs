import path from "path";
import { createWriteStream } from "fs";
import { stat, mkdir } from "fs/promises";
import { pipeline } from "stream/promises";

function convertBTTVEmote(emote) {
	return { platform: "bttv", id: emote.id, name: emote.code, ext: emote.imageType, url: `https://cdn.betterttv.net/emote/${emote.id}/3x` };
}

function convertFFZEmote(emote) {
	return { platform: "ffz", id: emote.id, name: emote.name, ext: "png", url: "https:" + (emote.urls["4"] || emote.urls["2"] || emote.urls["1"]) };
}

function convertSevenTvEmote(emote) {
	return { platform: "7tv", id: emote.id, name: emote.name, ext: "webp", url: `https://cdn.7tv.app/emote/${emote.id}/4x.webp` };
}

function convertTwitchEmote(emote) {
	return { platform: "twitch", id: emote.id, name: emote.code, ext: (emote.assetType === "STATIC" ? "png" : "gif"), url: `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/3.0`};
}

async function getBTTVChannelEmotes(userId) {
	const res = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${userId}`);
	const json = await res.json();

	return [
		...json.channelEmotes.map(convertBTTVEmote),
		...json.sharedEmotes.map(convertBTTVEmote)
	];
}

async function getFFZChannelEmotes(userId) {
	const res = await fetch(`https://api.frankerfacez.com/v1/room/id/${userId}`);
	const json = await res.json();

	return Object.values(json.sets).map(set => set.emoticons.map(convertFFZEmote)).flat();
}

async function getSevenTVChannelEmotes(userId) {
	const res = await fetch(`https://7tv.io/v3/users/twitch/${userId}`);
	const json = await res.json();

	return json.emote_set.emotes.map(convertSevenTvEmote);
}

async function getBTTVGlobalEmotes() {
	const res = await fetch("https://api.betterttv.net/3/cached/emotes/global");
	const json = await res.json();

	return json.map(convertBTTVEmote);
}

async function getFFZGlobalEmotes() {
	const res = await fetch("https://api.frankerfacez.com/v1/set/global");
	const json = await res.json();

	return json.sets["3"].emoticons.map(convertFFZEmote);
}

async function getSevenTVGlobalEmotes() {
	const res = await fetch("https://7tv.io/v3/emote-sets/global");
	const json = await res.json();

	return json.emotes.map(convertSevenTvEmote);
}

async function getTwitchEmotes(setId = 0) {
	const res = await fetch(`https://api.ivr.fi/v2/twitch/emotes/sets?set_id=${setId}`);
	const json = await res.json();

	return json[0].emoteList.map(convertTwitchEmote);
}

async function exists(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

async function downloadFile(url, path) {
	return pipeline(
		(await fetch(url)).body,
		createWriteStream(path)
	);
}

async function getUserId(username) {
	const res = await fetch(`https://api.ivr.fi/v2/twitch/user?login=${username}`);
	const json = await res.json();

	return json[0].id;
}

async function main() {
	const mode = process.argv[2];

	let emotes = [];

	switch (mode) {
		case "channel": {
			const userId = await getUserId(process.argv[3]);

			emotes = [
				...await getBTTVChannelEmotes(userId),
				...await getFFZChannelEmotes(userId),
				...await getSevenTVChannelEmotes(userId),
			];

			break;
		}
		case "global": {
			emotes = [
				...await getBTTVGlobalEmotes(),
				...await getFFZGlobalEmotes(),
				...await getSevenTVGlobalEmotes(),
				...await getTwitchEmotes(),
			];

			break;
		}
		default:
			console.log("Unknown mode");
	}

	const dir = path.resolve(process.argv.at(-1));
	await mkdir(dir, { recursive: true });
	for (const emote of emotes) {
		console.log(`Downloading ${emote.name} from ${emote.url}`);
		const dest = path.join(dir, `${emote.name.replace(/\//g, "∕")}-${emote.platform}-${emote.id}.${emote.ext}`);
		if (await exists(dest)) {
			console.warn(`This file already exists`);
		}
		else {
			await downloadFile(emote.url, dest);
		}
	}
}

main();
