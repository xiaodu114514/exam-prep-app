import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CompleteTaskDialog from '../src/components/CompleteTaskDialog.vue'

function mountDialog() {
  return mount(CompleteTaskDialog, {
    props: {
      task: {
        id: 't1',
        title: '背单词',
        date: '2025-11-04',
        completed: false,
        subjectId: 's1',
        amount: 50,
      },
      subjectName: '英语',
      subjectUnit: '单词',
    },
    global: {
      stubs: {
        teleport: true,
        ModalSheet: {
          template: '<div><slot /><div><slot name="footer" /></div></div>',
        },
      },
    },
  })
}

describe('完成任务弹窗', () => {
  it('默认填写任务设置的数量', () => {
    const w = mountDialog()
    expect((w.find('#actual-amount').element as HTMLInputElement).value).toBe('50')
  })

  it('确认时提交填写的实际完成量', async () => {
    const w = mountDialog()
    await w.find('#actual-amount').setValue('35')
    await w.find('.btn--primary').trigger('click')
    expect(w.emitted('confirm')?.[0][0]).toBe(35)
  })

  it('空值或负数显示校验提示', async () => {
    const w = mountDialog()
    await w.find('#actual-amount').setValue('')
    await w.find('.btn--primary').trigger('click')
    expect(w.emitted('confirm')).toBeFalsy()
    expect(w.text()).toContain('请输入实际完成量')

    await w.find('#actual-amount').setValue('-1')
    await w.find('.btn--primary').trigger('click')
    expect(w.text()).toContain('不小于 0')
  })
})
