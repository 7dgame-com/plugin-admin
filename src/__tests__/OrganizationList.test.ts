import { flushPromises, shallowMount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import OrganizationList from '../views/OrganizationList.vue'

const getOrganizations = vi.fn()
const createOrganization = vi.fn()
const updateOrganization = vi.fn()
const bindOrganizationUser = vi.fn()
const unbindOrganizationUser = vi.fn()

vi.mock('../api', () => ({
  getOrganizations: (...args: unknown[]) => getOrganizations(...args),
  createOrganization: (...args: unknown[]) => createOrganization(...args),
  updateOrganization: (...args: unknown[]) => updateOrganization(...args),
  bindOrganizationUser: (...args: unknown[]) => bindOrganizationUser(...args),
  unbindOrganizationUser: (...args: unknown[]) => unbindOrganizationUser(...args),
}))

const ElTableStub = defineComponent({
  props: {
    data: {
      type: Array,
      default: () => [],
    },
  },
  template: '<div class="el-table-stub">{{ JSON.stringify(data) }}</div>',
})

const passthroughStub = defineComponent({
  template: '<div><slot /></div>',
})

describe('OrganizationList', () => {
  beforeEach(() => {
    getOrganizations.mockReset()
    createOrganization.mockReset()
    updateOrganization.mockReset()
    bindOrganizationUser.mockReset()
    unbindOrganizationUser.mockReset()

    getOrganizations.mockResolvedValue({
      data: {
        code: 0,
        data: [
          { id: 1, title: 'Acme Studio', name: 'acme' },
        ],
      },
    })
  })

  it('loads organizations on mount and renders the returned organization payload', async () => {
    const wrapper = shallowMount(OrganizationList, {
      global: {
        plugins: [i18n],
        directives: {
          loading: () => {},
        },
        stubs: {
          ElTable: ElTableStub,
          ElCard: passthroughStub,
          ElTableColumn: passthroughStub,
          ElButton: passthroughStub,
          ElDialog: passthroughStub,
          ElForm: passthroughStub,
          ElFormItem: passthroughStub,
          ElInput: passthroughStub,
          ElSelect: passthroughStub,
          ElOption: passthroughStub,
        },
      },
    })

    await flushPromises()

    expect(getOrganizations).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Acme Studio')
    expect(wrapper.text()).toContain('acme')
  })
})
