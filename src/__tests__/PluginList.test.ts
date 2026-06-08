import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, inject, provide, reactive, ref, toRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import PluginList from '../views/PluginList.vue'

const {
  getPlugins,
  getOrganizations,
  updatePlugin,
  createPlugin,
  deletePlugin,
  notifyHostPluginRegistryChanged,
  confirm,
  success,
  error,
} = vi.hoisted(() => ({
  getPlugins: vi.fn(),
  getOrganizations: vi.fn(),
  updatePlugin: vi.fn(),
  createPlugin: vi.fn(),
  deletePlugin: vi.fn(),
  notifyHostPluginRegistryChanged: vi.fn(),
  confirm: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../api', () => ({
  getPlugins: (...args: unknown[]) => getPlugins(...args),
  getOrganizations: (...args: unknown[]) => getOrganizations(...args),
  updatePlugin: (...args: unknown[]) => updatePlugin(...args),
  createPlugin: (...args: unknown[]) => createPlugin(...args),
  deletePlugin: (...args: unknown[]) => deletePlugin(...args),
}))

vi.mock('../utils/hostEvents', () => ({
  notifyHostPluginRegistryChanged: () => notifyHostPluginRegistryChanged(),
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessageBox: {
      confirm: (...args: unknown[]) => confirm(...args),
    },
    ElMessage: {
      success: (...args: unknown[]) => success(...args),
      error: (...args: unknown[]) => error(...args),
    },
  }
})

const tableDataKey = Symbol('table-data')

const ElTableStub = defineComponent({
  name: 'ElTableStub',
  props: {
    data: {
      type: Array,
      default: () => [],
    },
  },
  setup(props, { slots }) {
    provide(tableDataKey, toRef(props, 'data'))
    return () => h('div', { class: 'el-table-stub' }, slots.default?.())
  },
})

const ElTableColumnStub = defineComponent({
  name: 'ElTableColumnStub',
  props: {
    prop: {
      type: String,
      default: '',
    },
  },
  setup(props, { slots }) {
    const rows = inject(tableDataKey, ref<unknown[]>([]))
    return () =>
      h(
        'div',
        { class: 'el-table-column-stub' },
        rows.value.map((row: any, index: number) =>
          h(
            'div',
            {
              class: 'el-table-cell-stub',
              'data-row-id': String(row.id ?? index),
              'data-prop': props.prop,
            },
            slots.default ? slots.default({ row, $index: index }) : String(row[props.prop] ?? '')
          )
        )
      )
  },
})

const ElSwitchStub = defineComponent({
  name: 'ElSwitchStub',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    beforeChange: {
      type: Function,
      default: undefined,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    async function handleClick() {
      if (props.disabled) {
        return
      }

      if (typeof props.beforeChange === 'function') {
        await props.beforeChange()
        return
      }

      emit('update:modelValue', !props.modelValue)
    }

    return () =>
      h(
        'button',
        {
          class: 'el-switch-stub',
          disabled: props.disabled,
          'data-checked': String(props.modelValue),
          'data-loading': String(props.loading),
          onClick: handleClick,
        },
        props.modelValue ? 'on' : 'off'
      )
  },
})

const ElDialogStub = defineComponent({
  name: 'ElDialogStub',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { slots }) {
    return () =>
      props.modelValue
        ? h('div', { class: 'el-dialog-stub' }, [slots.default?.(), slots.footer?.()])
        : null
  },
})

const ElFormStub = defineComponent({
  name: 'ElFormStub',
  props: {
    model: {
      type: Object,
      default: () => ({}),
    },
    rules: {
      type: Object,
      default: () => ({}),
    },
  },
  setup(props, { expose, slots }) {
    const errors = reactive<string[]>([])

    function resolveMessage(message: unknown) {
      return typeof message === 'function' ? String(message()) : String(message ?? '')
    }

    async function validate(callback?: (valid: boolean) => void | Promise<void>) {
      errors.splice(0, errors.length)

      Object.entries(props.rules).forEach(([field, fieldRules]) => {
        const value = (props.model as Record<string, unknown>)[field]
        const rules = Array.isArray(fieldRules) ? fieldRules : [fieldRules]

        rules.some((rule: any) => {
          const textValue = typeof value === 'string' ? value : String(value ?? '')
          const missingRequired = rule.required && textValue.trim() === ''
          const patternMismatch = rule.pattern instanceof RegExp && !rule.pattern.test(textValue)

          if (missingRequired || patternMismatch) {
            errors.push(resolveMessage(rule.message))
            return true
          }

          return false
        })
      })

      const valid = errors.length === 0
      await callback?.(valid)
      return valid
    }

    expose({ validate })

    return () =>
      h('form', { class: 'el-form-stub' }, [
        slots.default?.(),
        errors.map((message) => h('div', { class: 'el-form-error-stub' }, message)),
      ])
  },
})

const ElInputStub = defineComponent({
  name: 'ElInputStub',
  props: {
    modelValue: {
      type: [String, Number],
      default: '',
    },
    placeholder: {
      type: String,
      default: '',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        class: 'el-input-stub',
        disabled: props.disabled,
        placeholder: props.placeholder,
        'data-placeholder': props.placeholder,
        value: props.modelValue,
        onInput: (event: Event) => {
          emit('update:modelValue', (event.target as HTMLInputElement).value)
        },
      })
  },
})

const ElInputNumberStub = defineComponent({
  name: 'ElInputNumberStub',
  props: {
    modelValue: {
      type: Number,
      default: 0,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        class: 'el-input-number-stub',
        type: 'number',
        value: props.modelValue,
        onInput: (event: Event) => {
          emit('update:modelValue', Number((event.target as HTMLInputElement).value))
        },
      })
  },
})

const passthroughStub = defineComponent({
  name: 'PassthroughStub',
  setup(_props, { slots }) {
    return () => h('div', slots.default?.())
  },
})

const ElButtonStub = defineComponent({
  name: 'ElButtonStub',
  emits: ['click'],
  setup(_props, { emit, slots }) {
    return () =>
      h(
        'button',
        {
          class: 'el-button-stub',
          onClick: () => emit('click'),
        },
        slots.default?.()
      )
  },
})

function mountPluginList() {
  return mount(PluginList, {
    global: {
      plugins: [i18n],
      directives: {
        loading: () => {},
      },
      stubs: {
        ElTable: ElTableStub,
        ElTableColumn: ElTableColumnStub,
        ElSwitch: ElSwitchStub,
        ElButton: ElButtonStub,
        ElCard: passthroughStub,
        ElPagination: passthroughStub,
        ElDialog: ElDialogStub,
        ElForm: ElFormStub,
        ElFormItem: passthroughStub,
        ElInput: ElInputStub,
        ElSelect: passthroughStub,
        ElOption: passthroughStub,
        ElInputNumber: ElInputNumberStub,
      },
    },
  })
}

describe('PluginList', () => {
  beforeEach(() => {
    getPlugins.mockReset()
    getOrganizations.mockReset()
    updatePlugin.mockReset()
    createPlugin.mockReset()
    deletePlugin.mockReset()
    notifyHostPluginRegistryChanged.mockReset()
    confirm.mockReset()
    success.mockReset()
    error.mockReset()

    getPlugins.mockResolvedValue({
      data: {
        code: 0,
        data: {
          items: [
            {
              id: 'ai-3d-generator-v3',
              name: 'AI 3D 生成器 V3',
              url: 'http://localhost:3008/',
              organization_name: null,
              access_scope: 'manager-only',
              enabled: 1,
              version: '1.0.0',
              icon: null,
              order: 0,
              description: null,
              allowed_origin: 'http://localhost:3008',
              allowed_host_origins: [],
            },
          ],
          total: 1,
        },
      },
    })

    getOrganizations.mockResolvedValue({
      data: {
        code: 0,
        data: [],
      },
    })

    updatePlugin.mockResolvedValue({
      data: {
        code: 0,
      },
    })

    confirm.mockResolvedValue('confirm')
  })

  it('confirms before disabling a plugin from the list and persists the new enabled state', async () => {
    const wrapper = mountPluginList()

    await flushPromises()

    const switchButton = wrapper.get('.el-switch-stub')
    expect(switchButton.attributes('data-checked')).toBe('true')

    await switchButton.trigger('click')
    await flushPromises()

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('AI 3D 生成器 V3'),
      expect.any(String),
      expect.any(Object)
    )
    expect(updatePlugin).toHaveBeenCalledWith({
      id: 'ai-3d-generator-v3',
      enabled: 0,
    })
    expect(notifyHostPluginRegistryChanged).toHaveBeenCalledTimes(1)
    expect(success).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.el-switch-stub').attributes('data-checked')).toBe('false')
  })

  it('keeps the original state when the enable/disable confirmation is cancelled', async () => {
    confirm.mockRejectedValueOnce(new Error('cancel'))
    const wrapper = mountPluginList()

    await flushPromises()
    await wrapper.get('.el-switch-stub').trigger('click')
    await flushPromises()

    expect(updatePlugin).not.toHaveBeenCalled()
    expect(notifyHostPluginRegistryChanged).not.toHaveBeenCalled()
    expect(wrapper.get('.el-switch-stub').attributes('data-checked')).toBe('true')
  })

  it('renders the configured access_scope label from plugin rows', async () => {
    const wrapper = mountPluginList()

    await flushPromises()

    expect(wrapper.text()).toContain('manager 或 root')
  })

  it('normalizes legacy organization titles to organization names before saving', async () => {
    getOrganizations.mockResolvedValue({
      data: {
        code: 0,
        data: [
          { id: 2, name: 'msc', title: '澳門科學館' },
        ],
      },
    })
    getPlugins.mockResolvedValue({
      data: {
        code: 0,
        data: {
          items: [
            {
              id: 'ai-3d-generator-v3',
              name: 'AI 3D 生成器 V3',
              url: 'https://a23.hxgxonline.com/',
              organization_name: '澳門科學館',
              access_scope: 'manager-only',
              enabled: 1,
              version: '1.0.0',
              icon: null,
              order: 0,
              description: null,
              allowed_origin: null,
              allowed_host_origins: [],
            },
          ],
          total: 1,
        },
      },
    })

    const wrapper = mountPluginList()

    await flushPromises()
    expect(wrapper.text()).toContain('澳門科學館')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '编辑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '确定')!
      .trigger('click')
    await flushPromises()

    expect(updatePlugin).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ai-3d-generator-v3',
      organization_name: 'msc',
    }))
  })

  it('rejects plugin ids with spaces before sending a create request', async () => {
    const wrapper = mountPluginList()

    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新增插件')!
      .trigger('click')

    await wrapper.get('input[data-placeholder="如: my-plugin"]').setValue('ar slam')
    await wrapper.get('input[data-placeholder="插件显示名称"]').setValue('AR SLAM')
    await wrapper
      .get('input[data-placeholder="https://..."]')
      .setValue('https://ar-slam.d.plugins.xrugc.com/workbench')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '确定')!
      .trigger('click')
    await flushPromises()

    expect(createPlugin).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('插件ID只能包含字母、数字和连字符')
  })
})
