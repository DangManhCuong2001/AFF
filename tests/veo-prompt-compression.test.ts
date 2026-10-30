import test from 'node:test'
import assert from 'node:assert/strict'
import {buildVeoInteractionPrompt, validatePromptQuality, visualOnlyText, polishVeoDirection} from '../src/lib/video/veo-interaction-plan'
import {compressionFixture} from './fixtures/veo-compression'

test('Wording polish turns fragments into directing sentences without changing the plan or motion', () => {
  assert.equal(polishVeoDirection('Scrubbing the visible green side against the pan.'), 'Scrub the visible green side against the pan.')
  assert.equal(polishVeoDirection('Slight circular pivoting of the wrist'), 'Move the wrist in small circles.')
  assert.equal(polishVeoDirection('Gentle downward pressure adjustment'), 'Gently adjust the downward pressure.')
  assert.equal(polishVeoDirection('The hand holds the brush stationary after wiping.'), 'Keep holding the brush stationary as the motion settles.')
  assert.equal(polishVeoDirection('Opening remains visible.'), 'Opening remains visible.')
  const plan = compressionFixture('wall-hook', true)
  const before = JSON.stringify(plan)
  buildVeoInteractionPrompt(plan)
  assert.equal(JSON.stringify(plan), before)
})

for (const product of ['wall-hook', 'cable-organizer', 'car-phone-holder'] as const) {
  for (const inProgress of [false, true]) {
    test(`${product}: compression preserves action, movement, payoff and ${inProgress ? 'ongoing' : 'new'} timing`, () => {
      const plan = compressionFixture(product, inProgress)
      const prompt = buildVeoInteractionPrompt(plan)
      assert.equal(validatePromptQuality(prompt, plan).valid, true)
      assert.ok(prompt.includes(plan.primaryAction))
      assert.ok(prompt.includes(plan.endState))
      assert.ok(prompt.includes(`Keep the ${plan.productType} stationary throughout the shot.`))
      assert.equal(prompt.match(/contact point unobstructed/g)?.length, 1)
      assert.equal(prompt.split(/\s+/).length < 370, true)
      if (inProgress) {
        assert.match(prompt, /0–0\.5s/)
        assert.doesNotMatch(prompt, /establish|approaches|enters/i)
      } else assert.match(prompt, /0–1\.5s: establish/)
      assert.doesNotMatch(prompt, /End-state mode|Body-part state|until the planned action moves it|same product/i)
    })
  }
}

test('PromptQualityValidator rejects repetitions, unverified properties, claims, fixed-object movement and reset timing', () => {
  const plan = compressionFixture('car-phone-holder', true)
  const prompt = buildVeoInteractionPrompt(plan)
  const mutated = `${prompt}\nKeep the car phone holder stationary throughout the shot.\nRotate the car phone holder.\nUse an antibacterial surface.\nIt is instantly spotless.\n0–1.5s: establish the scene.`
  const issues = validatePromptQuality(mutated, plan).issues
  for (const issue of ['DUPLICATE_INSTRUCTION', 'UNVERIFIED_PROPERTY', 'PERFORMANCE_CLAIM', 'FIXED_OBJECT_MOVEMENT', 'ONGOING_INTERACTION_RESET']) assert.ok(issues.includes(issue), issue)
  assert.equal(visualOnlyText('the abrasive green side'), 'the green side')
  assert.equal(visualOnlyText('the abrasive green side', ['abrasive']), 'the abrasive green side')
  assert.ok(validatePromptQuality(`${prompt}\nPut the product down on the counter.`, {...plan, endStateMode: 'product-remains-held', releaseBehavior: 'do-not-release'}).issues.length > 0)
  const unexpectedEnding = prompt.replace('\nPAYOFF\n', '\nPAYOFF\nPut the product down on the counter.\n')
  assert.ok(validatePromptQuality(unexpectedEnding, plan).issues.includes('UNPLANNED_FINAL_ACTION'))
  const repeatedVisibility = prompt.replace('\nPAYOFF\n', '\nPAYOFF\nKeep the interaction point visible.\n')
  assert.ok(validatePromptQuality(repeatedVisibility, plan).issues.includes('DUPLICATE_INSTRUCTION'))
})
