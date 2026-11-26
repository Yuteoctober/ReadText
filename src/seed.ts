// Original sample documents, written for this app.
export const SEED_TITLE = 'Notes on the Reading Room'

export const SEED_CONTENT = `The best reading rooms are quiet in a particular way. They are not silent; silence is for empty places. A good reading room has the low hum of pages, the soft tick of a clock, and the occasional rustle when someone stretches and moves a chair. That hum is the sound of attention.

When I paste text into a reader, I am looking for that attention. Not a performance. Not a broadcast. I want the words to arrive at a pace I can follow, and I want to hear a voice that sounds like it is in the room with me, not like an announcement from a platform.

There is a difference between listening to something and being read to. Being read to is a gift. It hands you the meaning of a page and asks you to keep up. If the pace is too fast, the meaning slips. If it is too slow, the page loses its edge. The right speed is a kind of respect.

This little reader is built around that idea. You bring the text. The reader brings the voice. You can pause when you need to think, skip back when a sentence matters, and carry on when it does not. When the words are worth keeping, you can export a copy of the reading so it can live somewhere else.

Keep it simple. A document, a voice, a pace, and a place to go when the page is finished.`

export const THAI_TITLE = 'ห้องสมุดเงียบ'

// A short original Thai essay for testing Thai text + Thai voices.
// Includes Thai sentence-final `.` markers and spaces so the player's
// chunking and voice can breathe naturally.
export const THAI_CONTENT = `ห้องสมุดที่ดีมีเสียงเงียบในแบบของมันเอง ไม่ใช่ความเงียบที่ไร้ชีวิต แต่เป็นเสียงกระซิบของหน้ากระดาษ เสียงนาฬิกาเดิน และเสียงเก้าอี้ขยับเมื่อใครบางคนยืดตัว.

เมื่อเราวางข้อความไว้ในเครื่องอ่าน เราต้องการความใส่ใจ ไม่ใช่การแสดง เราต้องการคำที่ค่อย ๆ มาในจังหวะที่เราตามทัน และเสียงที่เหมือนคนในห้อง ไม่ใช่ประกาศจากระบบ.

การฟังกับถูกอ่านให้ฟังคนละอย่างกัน การถูกอ่านคือของขวัญ มันส่งความหมายของหน้ากระดาษมาให้เรา แล้วขอให้เราตามทัน ถ้าเร็วไป ความหมายจะไหลหนี ถ้าช้าไป หน้ากระดาษจะหมดเสน่ห์ จังหวะที่พอดีจึงเป็นความเคารพ.

เครื่องอ่านตัวเล็ก ๆ นี้สร้างจากแนวคิดนั้น คุณเอามาท่านมา และเครื่องอ่านเอามาเสียง คุณหยุดได้เมื่อต้องคิด ย้อนฟังได้เมื่อประโยคนั้นสำคัญ และเดินต่อได้เมื่อไม่จำเป็น.
`

export interface Sample {
  id: string
  label: string
  langCode: string
  title: string
  content: string
}

export const SAMPLES: Sample[] = [
  {
    id: 'en-reading-room',
    label: 'English · Notes on the Reading Room',
    langCode: 'en',
    title: SEED_TITLE,
    content: SEED_CONTENT,
  },
  {
    id: 'th-silent-library',
    label: 'ไทย · ห้องสมุดเงียบ',
    langCode: 'th',
    title: THAI_TITLE,
    content: THAI_CONTENT,
  },
]

export const SEED = { title: SEED_TITLE, content: SEED_CONTENT }
