import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { setDoc, getDoc, doc, collection, getDocs } from 'firebase/firestore'
import { ref, uploadBytes, listAll, getMetadata } from 'firebase/storage'
const env = await initializeTestEnvironment({
  projectId: 'demo-contability-test',
  firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules','utf8') },
  storage: { host: '127.0.0.1', port: 9199, rules: await readFile('storage.rules','utf8') },
})
try {
  const id = 's3-' + Date.now()
  const roles = { ana:'ADMIN', sol:'SUPERVISOR', leo:'OPERATOR', teo:'OPERATOR' }
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()
    for (const [uid, role] of Object.entries(roles)) await setDoc(doc(db,'users',uid), { role, active: true, name: uid })
    await setDoc(doc(db,'clients',id), { name:'Cliente de prueba', responsibleUserId:'leo' })
  })
  const folder = 'clients/' + id + '/documents'
  const contact = uid => doc(env.authenticatedContext(uid).firestore(),'clients',id,'contacts','contacto')
  const data = { name:'Elena', email:'elena@example.com', phone:'1234567890', position:'Tesorería', primary:true, payments:true }
  await assertSucceeds(setDoc(contact('ana'),data))
  assert.equal((await getDoc(contact('teo'))).data().payments,true)
  await assertFails(setDoc(contact('sol'), data))
  await assertFails(setDoc(contact('leo'), data))
  const bucket = uid => env.authenticatedContext(uid).storage('gs://demo-contability-test.appspot.com')
  const put = (uid, author = uid) => uploadBytes(ref(bucket(uid),folder+'/'+uid),new Uint8Array([1,2]), {
    customMetadata: { filename:'ejemplo.pdf', authorName:uid, authorId:author },
  })
  await assertSucceeds(put('sol'))
  await assertSucceeds(put('leo'))
  await assertFails(put('teo'))
  await assertFails(put('ana','sol'))
  const objects = await listAll(ref(bucket('teo'),folder))
  assert.equal(objects.items.length,2)
  const meta = await getMetadata(ref(bucket('teo'),folder+'/leo'))
  assert.equal(meta.customMetadata.authorId,'leo')
  assert.ok(meta.timeCreated)
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),'clients',id,'contacts')))
  console.log('Sprint 3: contactos, lectura del expediente y permisos de documentos verificados.')
} finally { await env.cleanup() }
