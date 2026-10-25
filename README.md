# Xebrine
Xebrine (pronounced *zeh-brine*) is a highly customizable, heavy-duty music player designed for people with massive local libraries, power users, and extremely long listening sessions. 

Made as a non-replacing spiritual successor to [Voxity](https://github.com/exerinity/voxity), Xebrine brings a noticably larger set of features, a more natural and friendly UI, and some absolutely bizarre things. 

The best way to summarise the difference between Xebrine and Voxity is: Xebrine is an experience, Voxity is a tool. Corny, I know. To be more colourful, Xebrine is a React chonker and Voxity is a vanilla JS workhorse.

> [!IMPORTANT]
> Because Xebrine needs the File System Access API for the file scanning functionality (basically the heart), it will only work on Chromium browsers on desktop and Android; and hence will not work on iPhone, Mozilla Firefox, and basically anywhere not Chromium. However, radio should work fine outside Chromium.
> Further, Voxity is *decently lightweight* for what it does; **Xebrine is not a lightweight player at all - it is heavy, by design.** If you're conscious about RAM usage, you probably shouldn't use this. (although, it uses about 200 to 350 MB, which is not bad compared to Spotify using 1 GB+...)

[![](https://meow.exerinity.gay/xeb2.png)](https://meow.exerinity.gay/xeb2.png)

## List of features
For a full list, check https://exerinity.com/projects/xebrine
- Folder scanning via the File System Access API into IndexedDB and sorted properly
- Three different search types: a simple filter, a more natural algorithmical search, and a "Deep search" to find songs based on morsels of metadata
- [Last.fm scrobbling](https://xebrine.com/lastfm)
- [A remote control](https://xebrine.com/remote)
- Online lyric searching and displaying, with click-to-jump lines from [LRCLIB](https://lrclib.net)
- A Spotify-inspired lyrics canvas creator, where you can generate images of selected lines (see screenshots)
- An "auto mix" feature which attempts to beat match songs with a transition duration of your choosing
- A fullscreen player with everything at a glance and the cover art as a background (see screenshots)
- The player bar can be made compact or comfortable, top or bottom, and has drawers for scanning & auto mix
- Context menus with right-click drag actions
- Playlist scanning and aggregation via M3U/PLS files

## Screenshots
For more, see https://exerinity.com/projects/xebrine/screenshots
### Fullscreen player
[![](https://meow.exerinity.gay/xeb.png)](https://meow.exerinity.gay/xeb.png)
### Lyrics image creator
[![](https://meow.exerinity.gay/xeb_lrc.png)](https://meow.exerinity.gay/xeb_lrc.png)
### Context menus
[![](https://meow.exerinity.gay/xeb_ctx.png)](https://meow.exerinity.gay/xeb_ctx.png)

## Electron
There is a rudimental Electron wrapper of Xebrine for Linux, which gives it MPRIS support and a more native file scanner available: see [the electron folder](electron) or [download it directly](https://espresso.exerinity.com/xebr/Xebrine-2.0.0.AppImage)

## License
Xebrine is available under the [MIT License](LICENSE)