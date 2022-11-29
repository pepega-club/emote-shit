#!/bin/sh
download() {
	node ./download.mjs channel $1 ./data/$1
}

download 33kk
download liphitc
download brian6932
download pajlada
download supinic
