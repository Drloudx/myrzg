// Authored Bézier drawings in the first seven mascots' 240×360 model space.
// This is an offline asset source, not a bitmap trace or runtime drawing engine.
// `node scripts/dev/mascot-drawings.mjs` emits files as JSON for apply_patch.
import { drawBatch3 } from './mascot-drawings-batch3.mjs'
import { drawBatch4 } from './mascot-drawings-batch4.mjs'
import { drawBatch5 } from './mascot-drawings-batch5.mjs'
import { refineDrawings } from './mascot-drawing-details.mjs'
const p = (d, fill, stroke, width) => `<path d="${d}"${fill ? ` fill="${fill}"` : ''}${stroke ? ` stroke="${stroke}"` : ''}${width ? ` stroke-width="${width}"` : ''}/>`
const circle = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="none"/>`
const eye = (x, y, color, light = '#f0d68b') => `<g>${p(`M${x-9} ${y-7}Q${x} ${y-12} ${x+8} ${y-7}L${x+6} ${y+8}Q${x} ${y+12} ${x-6} ${y+7}Z`, '#f5ecd9','none')}<ellipse cx="${x}" cy="${y}" rx="5.8" ry="9" fill="${color}" stroke="none"/>${p(`M${x-4} ${y+3}Q${x} ${y} ${x+4} ${y+3}L${x+3} ${y+8}L${x-3} ${y+8}Z`,light,'none')}<ellipse cx="${x+1}" cy="${y-3}" rx="2.2" ry="4.5" fill="#4d4c52" stroke="none"/>${circle(x-2,y-5,2.1,'#fff5dd')}${p(`M${x-9} ${y-8}Q${x} ${y-12} ${x+8} ${y-8}`,null,'#514a51',2.6)}</g>`
const flattenEye = svg => svg.replace(/^<g>/, '').replace(/<\/g>$/, '')
const eyes = (color, light, single = false) => `<g class="idle-eyes idle-motion">${flattenEye(eye(105,110,color,light))}${single ? '' : flattenEye(eye(144,107,color,light))}</g>`
const faceShadow = skin => '#' + [1,3,5].map(offset => Math.round(parseInt(skin.slice(offset, offset + 2), 16) * .91).toString(16).padStart(2, '0')).join('')
const face = skin => p('M79 80Q92 58 126 60Q157 59 171 82L166 117Q156 145 128 148Q96 147 82 126Z',skin)
  + p('M81 102Q84 125 102 137L128 148Q105 146 89 133L82 126Z',faceShadow(skin),'none')
  + p('M119 130Q123 133 128 130M124 119L126 121',null,'#927e77',1.3)
const ear = (d, skin, inner) => p(d,skin)+p(inner,null,'#a98782',1.7)
const diamond = (x,y,fill) => p(`M${x} ${y-7}L${x+5} ${y}L${x} ${y+7}L${x-5} ${y}Z`,fill,'#8a7750',1.5)
const jewel = (x,y) => p(`M${x-4} ${y-12}L${x+4} ${y-12}L${x+7} ${y+8}Q${x} ${y+15} ${x-7} ${y+8}Z`,'#b79b56')+p(`M${x-3} ${y-5}Q${x+4} ${y-9} ${x+4} ${y+4}Q${x} ${y+10} ${x-4} ${y+4}Z`,'#669d83','none')
const wrap = (id, parts) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360" fill="none" class="mascot-illustration" data-character="${id}" aria-hidden="true" focusable="false">
<!-- Hand-authored curves; reference public/test2/hero/hero_${id}.png. The live model adds articulated arms and legs. -->
<ellipse cx="122" cy="336" rx="43" ry="6" fill="#574d3a" opacity=".14"/>
<g stroke="#514b48" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><g class="idle-body idle-motion">
${Object.entries(parts).map(([name, svg])=>`<g data-rig-part="${name}">${svg}</g>`).join('\n')}
</g></g></svg>\n`
const drawings = {}

// 007: pink segmented twin buns, mint leaf wings, pointed ears and jeweled chains.
drawings['007'] = {
  hairLeft:
    p('M89 99Q52 86 4 72Q16 122 68 146L98 148Z','#a4c3b0')+
    p('M8 77L84 132M24 83L31 98L51 100M37 111L60 112L74 130',null,'#628d82',2)+
    p('M157 101Q198 85 239 79Q222 127 182 143L153 150Z','#a4c3b0')+
    p('M234 83L166 134M219 88L211 101L192 103M203 114L183 115L174 129',null,'#628d82',2)+
    p('M92 189Q58 210 27 259L72 245L94 216Z','#afcbb8')+
    p('M151 190Q195 215 219 258L176 240L149 213Z','#afcbb8')+
    p('M35 252L89 201M211 250L157 202',null,'#739b8d',2.5),
  hairRight:
    p('M89 184Q76 227 59 274L72 294L90 286L107 207Z','#bb788c')+
    p('M150 183Q166 230 187 277L174 294L157 286L136 207Z','#bb788c')+
    p('M65 272L73 288L79 277L84 286L90 271M159 272L165 288L170 276L175 286L181 274',null,'#ecd1c6',5),
  skirt:
    p('M94 208L151 208L168 243Q152 254 128 250Q102 256 82 243Z','#e8e3d4')+
    p('M90 234L96 239L104 236L114 242L123 238L134 242L144 237L153 240L161 234',null,'#b9baa7',1.5)+
    p('M124 244L136 246L145 266L137 275L127 269Z','#b39b58')+
    p('M135 267L129 285L136 291L131 305L125 310',null,'#756650',4),
  torso:
    p('M98 149L142 149L156 174L148 202L159 221L144 229L125 218L107 229L87 219L97 196L87 174Z','#a9c4b4')+
    p('M109 151L133 150L141 167Q137 185 124 192Q111 188 103 172Z','#f0e8d7')+
    p('M100 184L115 201L124 205L136 199L149 183M91 211L111 219M138 217L152 211',null,'#ab955b',5)+
    diamond(124,208,'#5a9d8a')+
    p('M99 177L112 184M139 177L133 188',null,'#7e9e93',1.5),
  front:p('M113 141L136 141L135 154L125 159L112 154Z','#eadfc7')+diamond(124,150,'#ae9d68'),
  head:
    p('M84 48Q48 25 29 55Q15 83 34 110Q49 128 82 114L95 79Z','#a9657c')+
    p('M163 45Q197 26 213 58Q228 91 207 111Q189 129 162 114L152 77Z','#a9657c')+
    p('M36 51Q50 62 78 58M29 72Q52 84 78 75M30 94Q51 104 79 93M170 55Q193 60 209 54M169 75Q195 84 217 74M172 96Q197 105 214 93',null,'#7c8790',7)+
    p('M70 106Q57 64 81 37L94 33L100 40L110 37L111 49L99 55L90 95Z','#eee4d3')+
    p('M175 103Q187 65 164 37L152 33L146 40L138 37L137 50L149 56L159 96Z','#eee4d3')+
    p('M76 105Q64 66 92 41M82 109Q74 69 99 43M169 103Q183 63 156 41M163 109Q175 66 149 43',null,'#bb9a50',4)+
    ear('M85 105L63 96L68 109L87 119Z','#efd0ba','M71 102L83 111')+
    ear('M164 103L188 94L180 110L163 118Z','#efd0ba','M178 101L166 110')+
    face('#efd0ba')+eyes('#929cb3','#c9c3d6')+
    p('M123 85L123 92M117 88L117 93M129 87L129 92',null,'#6e798b',2)+
    circle(99,127,2,'#ce7b84')+circle(151,124,2,'#ce7b84')+
    p('M117 43Q132 46 134 66L124 83L111 89L114 65Q93 84 91 111L98 177L84 180Q73 145 76 105Q71 77 90 57Z','#b27589')+
    p('M139 45Q163 54 165 86L161 119L174 180L160 181Q147 140 148 110Q153 82 136 67Z','#b27589')+
    p('M85 138L92 174M158 139L166 175',null,'#e2bcb8',8)+
    p('M124 48Q137 34 129 23Q151 34 136 58Z','#a5647b')+
    p('M93 67L110 52M151 72L148 58',null,'#86566f',1.7)+jewel(72,128)+jewel(175,125)
}

// 008: dark skin, swept white/flame hair, red goggles, flame wings and tail.
drawings['008'] = {
  hairLeft:
    p('M90 161Q64 162 45 127L49 154Q24 137 13 119L25 161L9 157Q28 197 50 205L30 206Q55 233 93 208Z','#e8c68d')+
    p('M155 161Q181 162 201 127L197 153L228 122L216 163L234 151Q226 192 208 202L224 200Q203 233 158 210Z','#e8c68d')+
    p('M15 124Q36 156 59 165L68 190Q42 169 32 167L27 169ZM228 127Q211 157 190 165L181 190L214 168L218 169Z','#cd6750','none')+
    p('M56 171Q79 193 92 178L92 206L59 211L41 202L64 204L45 188Z','#f2e2bd','none')+
    p('M188 171Q172 193 157 181L157 206L191 211L211 199L186 204L207 185Z','#f2e2bd','none'),
  hairRight:
    p('M145 228Q196 257 169 287Q148 302 132 280L145 280Q171 288 171 267L147 251Z','#a64f46')+
    p('M171 273Q161 286 144 277L134 279Q146 300 166 290Z','#e6bc7a','none'),
  skirt:
    p('M98 202L149 204L161 242L148 239L143 255L125 244L107 255L100 241L87 245Z','#c9654d')+
    p('M107 214L124 224L141 213L151 238L138 233L125 242L113 233L100 240Z','#ebbc7c','none')+
    p('M120 239L132 240L136 267L126 276L118 266Z','#51434a')+
    p('M130 269L126 285L131 291L125 307',null,'#9c8757',4),
  torso:
    p('M104 145L142 146L157 172L147 192L151 212L126 224L98 213L100 190L88 168Z','#3f3d46')+
    p('M104 154L100 182L109 205M143 155L150 179L140 207',null,'#c35a48',5)+
    p('M116 160L136 160L134 178L116 178Z','#634745')+
    diamond(125,176,'#629e84')+
    p('M120 184L119 204M129 184L130 205',null,'#ad9152',3),
  front:p('M110 138L136 137L143 152L129 157L122 150L113 156L104 149Z','#69444a')+diamond(125,144,'#c59d53'),
  head:
    p('M93 71Q89 45 108 31L134 21L118 39L116 55L130 62L115 80Z','#e7dfc9')+
    p('M100 46Q102 31 123 24L132 22L119 38L117 49Z','#e6b36a','none')+
    p('M111 33L121 22L141 20L129 29L130 23Z','#c76a4e')+
    p('M93 67Q90 43 108 34M99 71Q95 47 114 38',null,'#b89851',4)+
    ear('M88 105L70 96L76 115L90 121Z','#ad7d68','M78 105L85 114')+
    ear('M161 102L181 92L176 111L163 119Z','#ad7d68','M174 101L167 112')+
    face('#b1856d')+eyes('#689e92','#a3d0b7')+
    p('M80 105Q74 80 89 65L85 57L106 65L112 54L126 65L145 56L148 65L166 61L159 75L177 85L165 89L176 105L155 101L145 90L135 112L122 101L118 79L105 104L95 102L83 117Z','#e6e2d2')+
    p('M108 92L105 104L95 102L88 111L92 98ZM126 96L135 104L140 99L135 112ZM158 91L166 96L174 104L158 101Z','#cf7059','none')+
    p('M84 70L105 76L145 71L161 62',null,'#987c46',4)+
    p('M93 65Q100 59 106 65Q113 78 102 82Q92 82 89 73Z','#b49752')+
    p('M143 61Q151 54 158 62Q164 73 155 78Q144 79 140 70Z','#b49752')+
    circle(100,71,5,'#a74743')+circle(151,67,5,'#a74743')+
    p('M96 67L102 75M148 62L154 70',null,'#d87957',1.8)+
    p('M83 117L80 131L89 138L96 129M166 115L174 128L167 139L157 130',null,'#ede1c9',7)+
    p('M81 121L91 130M171 121L161 131',null,'#c76855',4)+jewel(76,137)+jewel(179,134)
}

// 009: feathered tall ears, blue skin, moth cloak, gold rings and bandage bodice.
drawings['009'] = {
  hairLeft:
    p('M82 103Q65 145 26 186L14 245L30 252L65 220L101 214L96 138Z','#515e69')+
    p('M167 106Q181 148 216 190L233 241L221 252L188 224L148 216L148 140Z','#515e69')+
    p('M83 130L27 226L22 242L57 218L94 203M163 131L217 225L226 240L189 218L154 203',null,'#869aa1',3)+
    p('M33 226L43 221L36 238L21 246ZM211 226L200 220L210 240L227 246Z','#e1d6b8')+
    circle(59,207,6,'#a9b4a6')+circle(188,209,6,'#a9b4a6'),
  hairRight:
    p('M104 246Q78 272 49 281L54 294Q81 302 108 271L132 257Z','#555560')+
    p('M50 282Q68 287 84 277L77 289L55 292Z','#ddd4be','none'),
  skirt:
    p('M95 201L151 200L166 230L152 246L128 235L103 248L81 232Z','#e4dac0')+
    p('M97 213L73 252L62 282L89 273L112 228ZM149 214L174 252L187 280L159 274L137 229Z','#514f58')+
    p('M77 250L83 246L91 257L84 264L69 271L75 258M172 250L165 246L158 258L166 265L179 271L173 258',null,'#c3b77d',4)+
    p('M87 218Q121 239 159 218',null,'#bca25d',3)+
    [94,111,143,155].map((x,i)=>circle(x,227+(i%2)*4,4,'#bda05a')).join(''),
  torso:
    p('M97 149L146 148L154 176L146 204L127 218L99 204L91 174Z','#afbdc8')+
    p('M98 151L144 154L146 183L97 182Z','#e9dec4')+
    p('M97 158L144 178M105 151L148 167M98 176L138 154',null,'#c1baa1',2)+
    p('M103 190L142 208M144 187L104 205',null,'#5e5e69',2)+
    p('M97 207Q126 216 148 204',null,'#baa15f',5),
  front:p('M89 139Q126 151 164 138L162 150Q125 163 91 151Z','#b59a52')+p('M96 144Q126 154 155 145',null,'#d8c383',2.5),
  head:
    p('M87 70Q60 53 63 28L80 39L92 62L98 47L108 76ZM162 69Q190 53 189 27L172 41L161 61L151 45L145 76Z','#e4dcc7')+
    p('M90 81Q74 62 85 22Q94 44 108 65L107 84ZM147 81Q156 55 174 21Q178 49 163 84Z','#50505d')+
    p('M88 36L99 66M170 36L159 66',null,'#899299',4)+
    p('M76 87Q78 57 126 59Q168 58 175 91L170 147L153 150L88 146L72 138Z','#52525e')+
    face('#a6b7c8')+eyes('#8a8eaf','#c4bfd5')+
    p('M120 134L123 131L126 134L129 131',null,'#79879d',1.5)+
    p('M81 76L105 65L124 70L145 61L165 75L169 109L157 117L153 91L138 105L125 97L118 111L99 98L96 116L84 121L76 105Z','#565462')+
    p('M101 75L112 85M137 75L129 91',null,'#777a88',2.2)+
    p('M83 81L73 68L66 70L69 80L58 77L61 89L74 94L79 103L88 99ZM167 78L182 66L188 71L182 82L195 80L192 92L175 99L166 95Z','#e8ddc5')+
    p('M83 77Q76 66 83 62Q91 63 91 75Q101 68 104 76Q103 84 91 83Q95 96 87 97Q80 94 83 83Q71 86 70 80Q73 74 83 77Z','#e9dcc1'),
}

// 011: stitched tall black cap, rose twin rolls, feather plume and open coat.
drawings['011'] = {
  hairLeft:
    p('M90 224Q48 219 28 183L30 169L20 174L18 157L10 165L12 141L22 151L27 129L39 145L44 130L52 153L58 146L62 172Q59 198 102 205Z','#c27683')+
    p('M23 154L33 180L43 176L47 191L66 206L91 214L86 225Q56 216 41 203L37 189L24 185Z','#de9a98','none')+
    p('M29 161L42 170L49 158M35 184L52 191M48 205L60 204',null,'#9f5f74',2),
  hairRight:
    p('M94 202L151 201L175 277L160 286L136 262L123 236L107 273L87 285L62 275Z','#444246')+
    p('M81 251L100 217L98 257L83 275M147 215L161 266L159 275',null,'#626065',2.5),
  skirt:
    p('M96 210L119 218L104 311L89 312L91 269L72 288L64 278ZM130 217L150 210L177 281L161 289L147 264L154 310L138 312Z','#3f3e42')+
    p('M103 225L99 272M141 225L151 270',null,'#9f9569',2)+
    p('M84 259L94 260L87 269L78 268ZM150 257L161 259L167 267L157 267Z','#ddd4c2')+
    p('M80 271L86 273L82 286L76 285ZM160 271L166 270L172 281L166 284Z','#bfa294'),
  torso:
    p('M98 147L145 147L158 174L149 197L155 222L131 228L124 214L112 228L88 222L96 194L86 173Z','#444246')+
    p('M113 160L135 157L143 176L135 183L143 195L131 193L125 207L118 194L106 199L110 182L101 174Z','#e0ddd1')+
    p('M103 210L143 211',null,'#c5bba0',6)+
    p('M95 205L153 204L153 213L98 216Z','#35393c')+
    p('M101 210L145 208',null,'#b5a97b',2),
  front:p('M90 136L160 134L155 154L138 169L107 163Z','#34383b')+p('M105 146L139 155L151 143',null,'#575557',2),
  head:
    p('M73 85Q40 64 36 90L41 116L63 132L89 119ZM167 84Q194 64 208 92L207 119L183 131L159 115Z','#be6d82')+
    p('M42 90L68 103L48 117M200 92L177 104L202 117',null,'#df9b9d',3)+
    p('M42 87Q53 86 77 100M202 89Q190 86 170 100',null,'#bd9e7e',3)+
    face('#e9b7af')+eyes('#a69ea6','#d0c3c3')+
    p('M78 106Q79 80 88 73L96 99L94 138L103 164Q91 162 82 147Z','#c49393')+
    p('M161 99L168 80Q177 120 160 158L148 169L151 133Z','#c49393')+
    p('M86 72Q121 48 151 64L168 82L167 100L148 99L145 78L145 103L128 103L126 78L124 103L107 102L105 81L97 97L83 94Z','#c77686')+
    p('M109 65L112 91M136 64L139 89',null,'#e89da3',2.5)+
    p('M77 75Q60 67 69 48L91 20L121 31L147 21L165 61L158 79L139 70L123 81L105 71L91 82Z','#444044')+
    p('M91 26L117 40L137 30L151 67',null,'#565158',2)+
    p('M91 37L100 65L111 73',null,'#ddd6c5',2.3)+
    p('M85 37L99 42L96 51L82 45ZM87 57L101 57L103 65L88 65Z','#9b826c')+
    p('M91 75L88 69L98 71L107 76L101 83L89 81L80 85L83 79L78 73L87 77Z','#e5e1d4')+
    circle(97,77,2,'#5b6770')
}

// 012: wolf muzzle and ears, quiver, rust scarf, wrapped chest, teal trousers.
drawings['012'] = {
  hairLeft:
    p('M92 98L53 141L35 145L40 137L22 143L29 129L12 132Q36 112 71 103Z','#9c563b')+
    p('M75 110L28 132L19 141M45 126L55 125',null,'#ca8050',3),
  hairRight:
    p('M91 215Q51 231 43 267Q36 292 61 296L77 286L89 290L103 274L113 250Z','#606872')+
    p('M46 265Q43 285 62 288L70 282L79 286L92 271Q67 280 58 264Z','#c8c8bd','none')+
    p('M69 230L59 242L66 240L56 253M78 249L70 263',null,'#414b57',2),
  satchel:
    p('M65 85L92 75L122 153L96 164Z','#675842')+
    p('M70 89L96 80M76 108L102 99',null,'#a68f66',3)+
    p('M79 114L51 65M86 109L62 58M95 111L75 58',null,'#d4c7a4',3)+
    p('M51 66L43 58L44 45L50 50L52 43L58 60ZM63 61L55 50L57 39L63 47L66 40L69 59ZM75 60L69 45L74 34L79 44L84 41L83 56Z','#ded9bf'),
  torso:
    p('M98 146L146 145L167 175L153 193L151 226L96 226L90 197L80 178Z','#b7bbb5')+
    p('M99 157L147 161L150 184L100 198L90 182Z','#dfded0')+
    p('M98 161L148 179M96 173L140 157M102 188L144 195',null,'#9ba59f',2)+
    p('M100 146L113 177L158 160M91 185L152 179M100 214L148 214',null,'#414343',6)+
    p('M97 201L111 212M100 196L116 208',null,'#a75a4c',2.5)+
    p('M97 220L151 220L158 252L136 255L124 243L115 255L90 249Z','#356f70')+
    p('M100 228L98 243M144 230L148 244',null,'#bf915c',2)+
    p('M91 221L153 220L149 232L135 233L127 241L116 233L95 232Z','#ddd7bd')+
    circle(117,230,2.4,'#5c594e')+circle(135,229,2.4,'#5c594e'),
  front:
    p('M85 132L163 126L165 140L141 158L112 162L89 150Z','#a4633e')+
    p('M94 140L120 147L152 136M113 151L130 151',null,'#d08a4c',2.5),
  head: '',
}
drawings['012'].head =
    p('M84 83L70 72L76 68L66 53L94 59L88 43L111 54L123 47L135 57L160 48L164 67L178 72L174 88L190 100L176 105L187 121L166 119L171 133L143 141L123 151L95 134L78 127L80 116','#5d6672')+
    p('M85 80Q77 54 91 22L111 70ZM142 70L178 21Q183 56 166 86Z','#525d69')+
    p('M88 65L93 38L102 70ZM153 68L174 39L164 76Z','#b9b9ac')+
    p('M94 89L87 81L104 87L111 75L121 87L136 78L145 89L165 85L159 100L176 113L168 126L149 136L129 147L112 137L93 137L96 126L78 120L94 110L84 100Z','#c9c9be')+
    p('M111 109L133 109L137 127L122 135L107 128Z','#e0ded1','none')+
    '<g class="idle-eyes idle-motion">'+flattenEye(eye(108,106,'#a76e3f','#d6a967'))+flattenEye(eye(147,103,'#a76e3f','#d6a967'))+'</g>'+
    p('M99 94L112 100M139 98L153 91',null,'#484f59',4)+
    p('M94 118L107 123M96 122L106 127M157 112L166 109',null,'#9e5c50',2)+
    p('M118 119Q133 113 149 120L160 128L146 139L127 138L114 132Z','#dfddce')+
    p('M140 119L151 121L149 127L140 128L136 124Z','#434b51')+
    p('M138 130L146 133L153 130',null,'#696f6b',1.5)+
    p('M151 134L176 146M172 143L173 151M164 140L170 137',null,'#625c4a',2)+
    p('M91 87L103 91M154 83L164 78',null,'#8e98a0',2)

// 014: fennec silhouette, large ears, cream crest, one gold eye and eyepatch.
drawings['014'] = {
  hairLeft:
    p('M93 218Q53 224 37 254L24 263L27 250L15 259L10 242Q0 275 21 290Q48 309 96 283L115 250Z','#bc754d')+
    p('M17 271Q33 295 82 280L69 292Q31 309 13 282Z','#694f42','none')+
    p('M51 243L36 263L47 258L41 273L65 264',null,'#d99664',3),
  torso:
    p('M100 145L144 145L156 166L149 193L155 219L129 229L97 219L93 194L85 170Z','#b76e42')+
    p('M115 159L136 159L141 197L117 204L108 181Z','#ecd3aa')+
    p('M109 145L153 185L146 195L104 161Z','#d9be94')+
    p('M111 155L145 186',null,'#f0d6ac',2)+
    p('M96 207L151 207L153 217L97 220Z','#bc9850')+
    p('M100 213L148 211',null,'#e6bc66',2)+
    p('M94 220L150 219L160 251L137 257L125 245L112 257L88 251Z','#d7a547')+
    p('M99 222L96 242L102 235L107 247L112 224M135 224L140 246L145 234L153 244L149 222',null,'#445357',4),
  front:
    p('M89 133L121 137L126 167L111 181L80 171','#383f43')+
    p('M89 138L112 144L116 166L104 172L87 165Z','#4d5357')+
    p('M90 150L104 151L107 160L91 159Z','#333b40')+
    circle(111,172,1.8,'#997955'),
  head:
    p('M82 88Q55 69 45 22Q76 44 99 66L104 89ZM147 87Q168 49 203 24Q194 70 166 91Z','#a9613c')+
    p('M56 37L93 72L88 84Q70 69 56 37ZM191 39Q175 75 156 83L158 72Z','#dca882')+
    p('M61 48L80 70',null,'#eed5ab',3)+
    p('M80 81Q97 65 128 67Q156 64 172 92L166 120L150 138L124 145L98 138L82 120L71 112L80 103L73 95Z','#c47c4e')+
    p('M97 114Q111 111 127 120L142 113L160 117L151 133L125 142L104 132Z','#e8d1a7')+
    eyes('#aa893c','#e3c573',true)+
    p('M90 97L110 94',null,'#5e493c',3)+
    p('M118 125L126 123L132 126L127 130L121 129Z','#50473d')+
    p('M121 135L127 136L133 133',null,'#7e6650',1.4)+
    p('M93 79Q89 59 102 37L102 52L113 44L119 21Q137 40 134 52L151 42L145 64L160 58L152 78L130 89L112 81Z','#dbb38a')+
    p('M111 53L119 38Q132 58 128 72L139 61L135 78L117 70','#f0d2a3','none')+
    p('M87 87L161 107M90 84L163 104',null,'#343e43',4)+
    p('M128 97L158 100L158 114L144 126L129 116Z','#343e43')+
    p('M135 103L150 106',null,'#515b5e',1.6)+
    p('M74 77L73 94Q81 104 86 94L86 84',null,'#756046',4)
}

// Remaining authored batches are appended here; only these files are emitted.
Object.assign(drawings, drawBatch3({ p, circle, face, eyes, jewel, diamond }))
Object.assign(drawings, drawBatch4({ p, circle, face, eyes, jewel, diamond }))
Object.assign(drawings, drawBatch5({ p, circle, face, eyes, jewel, diamond }))
refineDrawings(drawings, { p, circle, diamond })
const selected = new Set(process.argv.slice(2))
process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(drawings).filter(([id]) => !selected.size || selected.has(id)).map(([id, parts]) => [id, wrap(id, parts)]))))
