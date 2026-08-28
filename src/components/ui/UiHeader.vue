<template>
  <header class="ui-header">
    <div class="ui-header__left">
      <slot name="left">
        <img v-if="logo" :src="logo" class="ui-header__logo" alt="logo" />
        <h1 class="header-title">{{ title }}</h1>
      </slot>
    </div>
    <div class="ui-header__center"><slot /></div>
    <div class="ui-header__right"><slot name="right" /></div>
  </header>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  logo: { type: String, default: '/ui/logo.png' }
})
</script>

<style scoped>
.ui-header__left,
.ui-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  min-width: 0;
}

.ui-header__center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 16px;
}

.ui-header__logo {
  height: 38px;
  width: auto;
  object-fit: contain;
}

@media (max-width: 767px) {
  .ui-header__center { padding: 0 8px; }
}
</style>
