import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SubjectFormDialog from '../src/components/SubjectFormDialog.vue'

// 说明：科目保存与背诵联动的业务逻辑已迁移到服务端（server/test 的
// tasks/subjects/domain 测试覆盖），此处保留表单组件的纯 UI 校验测试。

interface SubjectLike {
  id: string
  name: string
  unit: string
  total: number
  completed: number
}

function mountDialog(subject: SubjectLike | null = null) {
  return mount(SubjectFormDialog, {
    props: { subject },
    global: {
      stubs: {
        teleport: true,
        ModalSheet: { template: '<div><slot /><div><slot name="footer" /></div></div>' },
      },
    },
  })
}

describe('组件层：SubjectFormDialog 保存', () => {
  it('填写有效数据后点击保存会触发 save 事件', async () => {
    const wrapper = mountDialog()
    await wrapper.find('#subject-name').setValue('高数')
    await wrapper.find('#subject-unit').setValue('章节')
    await wrapper.find('#subject-total').setValue('200')
    // 已完成量留空，默认 0
    await wrapper.find('.btn--primary').trigger('click')

    const emitted = wrapper.emitted('save')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({ name: '高数', unit: '章节', total: 200, completed: 0 })
  })

  it('已完成量超过总量时不触发 save', async () => {
    const wrapper = mountDialog()
    await wrapper.find('#subject-name').setValue('高数')
    await wrapper.find('#subject-total').setValue('100')
    await wrapper.find('#subject-completed').setValue('200')
    await wrapper.find('.btn--primary').trigger('click')

    expect(wrapper.emitted('save')).toBeFalsy()
    expect(wrapper.text()).toContain('不能超过总任务量')
  })
})

describe('组件层：SubjectFormDialog 数值边界', () => {
  it('总任务量为 0 时不触发 save 并提示', async () => {
    const wrapper = mountDialog()
    await wrapper.find('#subject-name').setValue('高数')
    await wrapper.find('#subject-total').setValue('0')
    await wrapper.find('.btn--primary').trigger('click')
    expect(wrapper.emitted('save')).toBeFalsy()
    expect(wrapper.text()).toContain('大于 0')
  })

  it('已完成量为负数时不触发 save 并提示', async () => {
    const wrapper = mountDialog()
    await wrapper.find('#subject-name').setValue('高数')
    await wrapper.find('#subject-total').setValue('100')
    await wrapper.find('#subject-completed').setValue('-5')
    await wrapper.find('.btn--primary').trigger('click')
    expect(wrapper.emitted('save')).toBeFalsy()
    expect(wrapper.text()).toContain('不小于 0')
  })

  it('编辑模式预填原有数值', async () => {
    const subject: SubjectLike = { id: 's1', name: '英语', unit: '单词', total: 3000, completed: 780 }
    const wrapper = mountDialog(subject)
    expect((wrapper.find('#subject-total').element as HTMLInputElement).value).toBe('3000')
    expect((wrapper.find('#subject-completed').element as HTMLInputElement).value).toBe('780')
  })
})
