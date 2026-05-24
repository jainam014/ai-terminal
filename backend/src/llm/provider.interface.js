class LLMProvider {
  async translate(_input) {
    throw new Error('translate() must be implemented');
  }

  name() {
    return 'base';
  }
}

module.exports = { LLMProvider };
