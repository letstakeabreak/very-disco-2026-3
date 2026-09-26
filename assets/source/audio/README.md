# Game sounds

`public/assets/audio/*.mp3` are cut from 13 CC0 recordings on Freesound (PRD 1.2.1). CC0 needs no
attribution; the authors are still credited here and on the title screen's credits.

- [sources.json](sources.json): each recording's Freesound page, author, license, preview URL, sha256 and use.
- [make-audio.py](make-audio.py): the exact cut of each sound (region, fades, level). It downloads the previews again (checked against sha256), cuts them and writes mono 44.1 kHz MP3s at 96 kbps. Run it with `python3 assets/source/audio/make-audio.py`.
- [loops.json](loops.json): the seamless loop windows the app uses for the bed, the ram and the creak.

| Sound | Recording | Author |
|---|---|---|
| bed-sea | [Underwater Ambience](https://freesound.org/people/Fission9/sounds/504641/) | Fission9 |
| bed-hull | [G45-32-Submarine Big Interior](https://freesound.org/people/craigsmith/sounds/438734/) | craigsmith |
| press | [Hydraulic press working and shut down](https://freesound.org/people/Andriejus/sounds/866648/) | Andriejus |
| creak | [Creaking Metal - Slow](https://freesound.org/people/EagleStealthTeam/sounds/172411/) | EagleStealthTeam |
| break-glass | [Glass Break](https://freesound.org/people/unfa/sounds/221528/) | unfa |
| break-metal | [machine hydraulic metal cutter close crunch2](https://freesound.org/people/kyles/sounds/453304/) | kyles |
| release | [Air Hiss](https://freesound.org/people/Jofae/sounds/367125/) | Jofae |
| store | [Box with Metal Latches Hit 2](https://freesound.org/people/suspensiondigital/sounds/389705/) | suspensiondigital |
| discard | [Impact on metal](https://freesound.org/people/JoMungus/sounds/726486/) | JoMungus |
| hull-groan | [Stereotypical sinking submarine sound](https://freesound.org/people/Ubehag/sounds/232021/) | Ubehag |
| drip | [WATER DRIP 2 ECHO LOW PITCH](https://freesound.org/people/mlsprovideos/sounds/135443/) | mlsprovideos |
| alarm | [Submarine submersion alarm](https://freesound.org/people/Guialgarve/sounds/480898/) | Guialgarve |
| click | [Button click](https://freesound.org/people/Kolombooo/sounds/629020/) | Kolombooo |

Loops pass a seam check after encoding: the jump at each loop point is within the recording's own sample-to-sample range.
