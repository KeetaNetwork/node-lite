# Default target
all: dist

CLIENT_PKG := node_modules/@keetanetwork/keetanet-client

SRC_TS := $(shell find src -type f -name '*.ts' ! -name '*.test.ts' ! -name '*.FROM_NODE.ts' 2>/dev/null)

DIST_SOURCES := \
	$(SRC_TS) \
	tsconfig.json \
	package.json \
	Makefile \
	scripts/extract-gcp-kms-common.js

# Client-shipped modules: copy into src/ (co-located tests) and dist/ (package).
CLIENT_MODULE_PATHS := \
	lib/utils/external-keys/gcp-kms.js \
	lib/utils/external-keys/gcp-kms-wrapped.js \
	lib/utils/external-keys/passkey-prf.js \
	lib/utils/external-keys/gcp-kms.common.js \
	lib/utils/external-keys/gcp-kms.d.ts \
	lib/utils/external-keys/gcp-kms-wrapped.d.ts \
	lib/utils/external-keys/passkey-prf.d.ts \
	lib/utils/external-keys/gcp-kms.common.d.ts \
	lib/log/target_https.js \
	lib/log/target_gcp.js \
	lib/log/target_https.d.ts \
	lib/log/target_gcp.d.ts \
	lib/log/common.d.ts \
	lib/log/internal.d.ts \
	lib/log/helper.generated.d.ts

SRC_CLIENT_COPIED := $(addprefix src/,$(CLIENT_MODULE_PATHS))
DIST_CLIENT_COPIED := $(addprefix dist/,$(CLIENT_MODULE_PATHS))

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  all         - Builds dist/"
	@echo "  dist        - Compiles TypeScript and copies client-shipped modules"
	@echo "  test        - Runs in-memory/local suites (override with KEETANET_TEST_EXTRA_ARGS)"
	@echo "  do-lint     - Runs eslint on the project source (override with KEETANET_ESLINT_EXTRA_ARGS)"
	@echo "  do-npm-pack - Creates a distributable npm package (.tgz)"
	@echo "  clean       - Removes build artifacts"
	@echo "  distclean   - Removes build artifacts and node_modules"

node_modules/.done: Makefile package.json package-lock.json
	rm -rf node_modules
	rm -rf dist
	rm -f .tsbuildinfo
	npm clean-install --ignore-scripts
	@touch node_modules/.done

node_modules: node_modules/.done
	@touch node_modules

# Files from the installed client package. Declare them so `make -j` after
# distclean waits for npm install instead of treating missing paths as
# targets with no rule.
$(CLIENT_PKG)/%: node_modules/.done
	@test -f $@

src/lib/utils/external-keys dist/lib/utils/external-keys src/lib/log dist/lib/log:
	mkdir -p $@

# $(dir ...) includes a trailing slash; strip it so order-only deps match the mkdir rules.
define COPY_FROM_CLIENT
src/$(1): $(CLIENT_PKG)/$(1) node_modules/.done | $$(patsubst %/,%,src/$(dir $(1)))
	cp $$< $$@

dist/$(1): $(CLIENT_PKG)/$(1) dist/.tsc.done | $$(patsubst %/,%,dist/$(dir $(1)))
	cp $$< $$@
endef

$(eval $(call COPY_FROM_CLIENT,lib/utils/external-keys/gcp-kms.js))
$(eval $(call COPY_FROM_CLIENT,lib/utils/external-keys/gcp-kms-wrapped.js))
$(eval $(call COPY_FROM_CLIENT,lib/utils/external-keys/passkey-prf.js))
$(eval $(call COPY_FROM_CLIENT,lib/log/target_https.js))
$(eval $(call COPY_FROM_CLIENT,lib/log/target_gcp.js))
$(eval $(call COPY_FROM_CLIENT,lib/utils/external-keys/gcp-kms.d.ts))
$(eval $(call COPY_FROM_CLIENT,lib/utils/external-keys/gcp-kms-wrapped.d.ts))
$(eval $(call COPY_FROM_CLIENT,lib/utils/external-keys/passkey-prf.d.ts))
$(eval $(call COPY_FROM_CLIENT,lib/utils/external-keys/gcp-kms.common.d.ts))
$(eval $(call COPY_FROM_CLIENT,lib/log/target_https.d.ts))
$(eval $(call COPY_FROM_CLIENT,lib/log/target_gcp.d.ts))
$(eval $(call COPY_FROM_CLIENT,lib/log/common.d.ts))
$(eval $(call COPY_FROM_CLIENT,lib/log/internal.d.ts))
$(eval $(call COPY_FROM_CLIENT,lib/log/helper.generated.d.ts))

# gcp-kms.common.js is folded into gcp-kms.js in the client package; extract it.
src/lib/utils/external-keys/gcp-kms.common.js: $(CLIENT_PKG)/lib/utils/external-keys/gcp-kms.js scripts/extract-gcp-kms-common.js node_modules/.done | src/lib/utils/external-keys
	node scripts/extract-gcp-kms-common.js $< $@

dist/lib/utils/external-keys/gcp-kms.common.js: $(CLIENT_PKG)/lib/utils/external-keys/gcp-kms.js scripts/extract-gcp-kms-common.js dist/.tsc.done | dist/lib/utils/external-keys
	node scripts/extract-gcp-kms-common.js $< $@

dist/.tsc.done: node_modules/.done $(DIST_SOURCES) $(SRC_CLIENT_COPIED)
	npx tsc -p tsconfig.json
	find dist -type f \( -name '*.test.js' -o -name '*.test.d.ts' -o -name '*.test.js.map' \) -delete 2>/dev/null || true
	@touch dist/.tsc.done

dist/.done: dist/.tsc.done $(DIST_CLIENT_COPIED)
	cp package.json dist/package.json
	@touch dist/.done

dist: dist/.done
	@touch dist

test: dist
	npx jest --config .jest.config.js $(KEETANET_TEST_EXTRA_ARGS)

do-lint: node_modules
	npm run eslint -- --config .eslint.config.mjs $(KEETANET_ESLINT_EXTRA_ARGS)

do-npm-pack: dist
	npm pack

clean:
	rm -rf dist
	rm -f .tsbuildinfo
	rm -f $(SRC_CLIENT_COPIED)
	test ! -e src/lib/utils/external-keys/ || rmdir src/lib/utils/external-keys
	test ! -e src/lib/utils/testing/ || rmdir src/lib/utils/testing/
	rm -f keetanetwork-keetanet-node-lite-*.tgz

distclean: clean
	rm -rf node_modules
	find src -type f -name '*.FROM_NODE*.ts' -delete

do-copy-node-tests:
	@test -n "$(KEETANET_NODE_SRC_DIR)" || (echo "KEETANET_NODE_SRC_DIR is not set; unable to copy node tests" && exit 1)
	( \
		cd "$(KEETANET_NODE_SRC_DIR)" && \
		find src -name '*.test.ts'; \
	) | while IFS='' read -r file; do \
		relpath=$${file#src/} && \
		dest=src/$${relpath%.test.ts}.FROM_NODE.test.ts && \
		mkdir -p $$(dirname "$$dest") && \
		cp -v "$(KEETANET_NODE_SRC_DIR)/$$file" "$$dest" || exit 1; \
	done
	cp -v "$(KEETANET_NODE_SRC_DIR)/src/client/client_common_tests.ts" src/client/client_common_tests.FROM_NODE.ts
	rm -f src/client/browser.FROM_NODE.test.ts \
		src/lib/log/target_gcp.FROM_NODE.test.ts \
		src/lib/log/target_https.FROM_NODE.test.ts \
		src/lib/log/index.FROM_NODE.test.ts \
		src/lib/utils/testing/passkey.FROM_NODE.test.ts \
		src/lib/utils/external-keys/gcp-kms.common.FROM_NODE.test.ts \
		src/lib/utils/external-keys/passkey-prf.FROM_NODE.test.ts \
		src/lib/utils/external-keys/gcp-kms-wrapped.FROM_NODE.test.ts \
		src/lib/utils/external-keys/gcp-kms.FROM_NODE.test.ts \
		src/lib/ledger/db_spanner.FROM_NODE.test.ts \
		src/lib/ledger/db_postgres.FROM_NODE.test.ts \
		src/lib/ledger/db_sqlite.FROM_NODE.test.ts
	sed "s@'\.test\.ts'@'.FROM_NODE.test.ts'@g" src/lib/ledger/db_memory.FROM_NODE.test.ts > src/lib/ledger/db_memory.FROM_NODE.test.ts.new && \
		mv src/lib/ledger/db_memory.FROM_NODE.test.ts.new src/lib/ledger/db_memory.FROM_NODE.test.ts
	sed 's@client_common_tests@client_common_tests.FROM_NODE@g' src/client/index.FROM_NODE.test.ts >> src/client/index.FROM_NODE.test.ts.new && \
		mv src/client/index.FROM_NODE.test.ts.new src/client/index.FROM_NODE.test.ts
	echo '// @ts-nocheck' > src/client/client_common_tests.FROM_NODE.ts.new && \
		cat src/client/client_common_tests.FROM_NODE.ts >> src/client/client_common_tests.FROM_NODE.ts.new && \
		mv src/client/client_common_tests.FROM_NODE.ts.new src/client/client_common_tests.FROM_NODE.ts

.PHONY: all help test do-lint do-npm-pack clean distclean do-copy-node-tests
