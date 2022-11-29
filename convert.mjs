import path from "path";
import sharp from "sharp";
import { readdir, mkdir } from "fs/promises";
import { fileURLToPath } from 'url'
import { Worker, isMainThread, workerData } from "worker_threads";

async function getOutPath(dir, animated, fucked, name) {
	const _dir = path.join(dir, animated ? (fucked ? "fucked" : "video") : "static");
	await mkdir(_dir, { recursive: true });
	return path.join(_dir, `${name}.${animated ? "gif" : "webp"}`);
}

function getDelay(delay, index) {
	return Array.isArray(delay) ? delay[index] : delay;
}

function getDuration(delay, pages) {
	if (Array.isArray(delay)) {
		return delay.reduce((collected, current) => collected + current);
	}
	else {
		return delay * pages;
	}
}

function scaleDelay(delay, k) {
	if (Array.isArray(delay)) {
		return delay.map(d => Math.floor(d * k));
	}
	else {
		return Math.floor(delay * k);
	}
}

function fitIntoMaxDuration(delay, pages, maxDuration) {
	const current = getDuration(delay, pages);
	if (current > maxDuration) {
		console.log("xdd", maxDuration / current);
		return scaleDelay(delay, maxDuration / current);
	}
	else {
		return delay;
	}
}

function trimToDuration(delay, pages, maxDuration) {
	let duration = 0;
	let p = 0;

	while (true) {
		if (p >= pages) break;

		const d = getDelay(delay, p);

		if ((duration + d) > maxDuration) break;

		duration += d;
		p++;
	}

	const _delay = Array.isArray(delay) ? delay.slice(0, p) : delay;
	return { delay: _delay, duration, pages: p }
}

async function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
	const __filename = fileURLToPath(import.meta.url)

	let running = 0;
	const dir = path.resolve(process.argv[2]);
	for (const file of await readdir(dir)) {
		while (running >= 8) {
			await sleep(1);
		}
		running++;

		new Worker(__filename, { workerData: [path.join(dir, file), path.resolve(process.argv[3])] }).on("exit", () => {
			running--;
		});
	}
}

async function convert(file, dir) {
	const name = path.parse(file).name;

	console.log(`${name}`);
	const image = sharp(file, { animated: true });
	const metadata = await image.metadata();

	if (!metadata.pages && !metadata.delay) {
		await sharp(file)
		.resize(512, 200, {
			fit: sharp.fit.contain,
			position: sharp.gravity.left,
			background: { r: 0, g: 0, b: 0, alpha: 0 }
		})
		.toFile(await getOutPath(dir, false, false, name));
		return;
	}

	const full_duration = getDuration(metadata.delay, metadata.pages);

	await sharp(file, { animated: true })
	.gif({ delay: fitIntoMaxDuration(metadata.delay, metadata.pages, 2700) })
	.resize(512, 200, {
		fit: sharp.fit.contain,
		position: sharp.gravity.left,
		background: { r: 0, g: 0, b: 0, alpha: 0 }
	})
	.toFile(await getOutPath(dir, true, full_duration >= 2700, name));
}

if (isMainThread) {
	main();
}
else {
	convert(...workerData).catch(e => console.error(workerData, e));
}
